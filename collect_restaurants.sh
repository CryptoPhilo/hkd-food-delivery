#!/bin/bash
# 한경면 실제 식당 데이터 수집 및 일괄 등록 스크립트
# 카카오 REST API 직접 호출 → JSON 저장 → Admin API로 등록

# 환경변수에서 키 로드 (.env 파일 또는 시스템 환경변수)
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

KAKAO_KEY="${KAKAO_REST_API_KEY:?'KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.'}"
ADMIN_URL="${ADMIN_URL:-https://hkd-backend.fly.dev/api/v1/admin/restaurants}"
ADMIN_KEY="${ADMIN_API_KEY:?'ADMIN_API_KEY 환경변수가 설정되지 않았습니다.'}"
OUTPUT_FILE="collected_restaurants.json"

echo "=== 한경면 실제 식당 데이터 수집 ==="
echo ""

# 1단계: 카카오 API로 데이터 수집
echo "[1/3] 카카오 API로 식당 검색 중..."

# 임시 디렉토리
TMPDIR=$(mktemp -d)

KEYWORDS=("한경면 음식점" "한경면 맛집" "한경면 카페" "한경면 분식" "저지리 음식점" "판포리 음식점" "고산리 음식점" "신창리 음식점" "협재 음식점" "한림 음식점" "한경면 치킨" "한경면 중국집" "한경면 횟집" "한경면 고기" "협재 카페" "한림 카페" "협재 맛집" "한림 맛집")

IDX=0
for keyword in "${KEYWORDS[@]}"; do
    for page in 1 2 3; do
        ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$keyword'))")
        URL="https://dapi.kakao.com/v2/local/search/keyword.json?query=${ENCODED}&page=${page}&size=15"

        RESULT=$(curl -s -H "Authorization: KakaoAK $KAKAO_KEY" "$URL")

        # 결과가 유효한지 확인
        COUNT=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('documents',[])))" 2>/dev/null)

        if [ -n "$COUNT" ] && [ "$COUNT" -gt 0 ]; then
            echo "$RESULT" > "$TMPDIR/result_${IDX}.json"
            echo "  $keyword (페이지$page): ${COUNT}개"
            IDX=$((IDX + 1))
        else
            break  # 다음 페이지 없으면 다음 키워드로
        fi
    done
done

echo ""

# 2단계: 중복 제거 및 등록용 JSON 생성
echo "[2/3] 중복 제거 및 데이터 정리..."

python3 << 'PYEOF'
import json, glob, os, sys

tmpdir = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('TMPDIR', '/tmp')

# 모든 결과 파일 읽기
all_places = {}
files = sorted(glob.glob(f"{tmpdir}/result_*.json"))

for f in files:
    with open(f, 'r') as fp:
        try:
            data = json.load(fp)
            for doc in data.get('documents', []):
                pid = doc.get('id', '')
                if pid and pid not in all_places:
                    # 음식점/카페 카테고리만 필터
                    cat_group = doc.get('category_group_code', '')
                    if cat_group not in ('FD6', 'CE7', ''):
                        continue
                    # 제주 지역만 필터 (주소에 '제주'가 반드시 포함)
                    addr = doc.get('address_name', '')
                    if '제주' not in addr:
                        continue
                    all_places[pid] = doc
        except:
            pass

print(f"  고유 장소: {len(all_places)}개")

# 등록용 데이터 변환
restaurants = []
for pid, p in all_places.items():
    cat_name = p.get('category_name', '')
    # 카테고리 간소화
    if '카페' in cat_name or '커피' in cat_name:
        simple_cat = '카페'
    elif '치킨' in cat_name:
        simple_cat = '치킨'
    elif '중식' in cat_name or '중국' in cat_name:
        simple_cat = '중식'
    elif '일식' in cat_name or '초밥' in cat_name or '회' in cat_name:
        simple_cat = '일식/횟집'
    elif '분식' in cat_name or '떡볶이' in cat_name:
        simple_cat = '분식'
    elif '피자' in cat_name or '양식' in cat_name or '패스트' in cat_name:
        simple_cat = '양식/피자'
    elif '고기' in cat_name or '삼겹' in cat_name or '갈비' in cat_name:
        simple_cat = '고기/구이'
    elif '한식' in cat_name or '백반' in cat_name or '국밥' in cat_name:
        simple_cat = '한식'
    else:
        simple_cat = '기타'

    r = {
        'name': p.get('place_name', ''),
        'address': p.get('address_name', ''),
        'roadAddress': p.get('road_address_name', ''),
        'latitude': float(p.get('y', 0)),
        'longitude': float(p.get('x', 0)),
        'category': simple_cat,
        'phone': p.get('phone', ''),
        'description': cat_name,
        'isActive': True,
        'isDeliverable': True,
        'deliveryRadius': 5,
        'rating': 0,
        'menus': []
    }
    restaurants.append(r)

# 이름순 정렬
restaurants.sort(key=lambda x: x['name'])

with open('collected_restaurants.json', 'w', encoding='utf-8') as f:
    json.dump(restaurants, f, ensure_ascii=False, indent=2)

print(f"  collected_restaurants.json 저장 완료 ({len(restaurants)}개)")
print()

# 목록 출력
for i, r in enumerate(restaurants, 1):
    phone = r['phone'] or '-'
    print(f"  {i:3d}. {r['name']:20s} | {r['category']:8s} | {phone}")

PYEOF
"$TMPDIR"

echo ""

# 3단계: Admin API로 일괄 등록
echo "[3/3] 백엔드 Admin API로 일괄 등록..."

python3 << PYEOF
import json, urllib.request

ADMIN_URL = "$ADMIN_URL"
ADMIN_KEY = "$ADMIN_KEY"

with open('collected_restaurants.json', 'r', encoding='utf-8') as f:
    restaurants = json.load(f)

if not restaurants:
    print("  등록할 식당이 없습니다.")
    exit(1)

success = 0
fail = 0

for r in restaurants:
    try:
        data = json.dumps(r).encode('utf-8')
        req = urllib.request.Request(
            ADMIN_URL,
            data=data,
            headers={
                'Content-Type': 'application/json',
                'X-Admin-Key': ADMIN_KEY
            },
            method='POST'
        )
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            if result.get('success'):
                success += 1
                print(f'  OK {r["name"]}')
            else:
                fail += 1
                print(f'  FAIL {r["name"]}: {result.get("error", "unknown")}')
    except Exception as e:
        fail += 1
        print(f'  FAIL {r["name"]}: {str(e)}')

print()
print(f"=== 완료: {success}개 등록 성공, {fail}개 실패 ===")
PYEOF

# 정리
rm -rf "$TMPDIR"
echo ""
echo "Done!"
