#!/bin/bash
# 제주 지역이 아닌 식당을 찾아서 삭제

# 환경변수에서 키 로드
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

ADMIN_URL="${ADMIN_URL:-https://hkd-backend.fly.dev/api/v1/admin/restaurants}"
ADMIN_KEY="${ADMIN_API_KEY:?'ADMIN_API_KEY 환경변수가 설정되지 않았습니다.'}"

echo "=== 타 지역 식당 정리 ==="
echo ""

# 전체 식당 가져오기
curl -s -H "X-Admin-Key: $ADMIN_KEY" "$ADMIN_URL?limit=500" | python3 -c "
import sys, json

data = json.load(sys.stdin)
restaurants = data.get('data', [])
print(f'전체 식당: {len(restaurants)}개')
print()

remove_list = []
keep_list = []

for r in restaurants:
    addr = r.get('address', '') or ''
    is_jeju = '제주' in addr

    if not is_jeju:
        remove_list.append(r)
        print(f'  삭제 대상: {r[\"name\"]:20s} | {addr}')
    else:
        keep_list.append(r)

print()
print(f'유지: {len(keep_list)}개, 삭제 대상: {len(remove_list)}개')

# 삭제 대상 ID를 파일로 저장
with open('/tmp/remove_ids.json', 'w') as f:
    json.dump([{'id': r['id'], 'name': r['name']} for r in remove_list], f, ensure_ascii=False)
"

echo ""
read -p "삭제를 진행하시겠습니까? (y/n): " CONFIRM

if [ "$CONFIRM" = "y" ]; then
    python3 -c "
import json, urllib.request, ssl, certifi

ctx = ssl.create_default_context(cafile=certifi.where())

with open('/tmp/remove_ids.json', 'r') as f:
    items = json.load(f)

deleted = 0
for item in items:
    try:
        req = urllib.request.Request(
            '${ADMIN_URL}/' + item['id'],
            headers={'X-Admin-Key': '${ADMIN_KEY}'},
            method='DELETE'
        )
        urllib.request.urlopen(req, context=ctx)
        deleted += 1
        print(f'  삭제: {item[\"name\"]}')
    except Exception as e:
        print(f'  실패: {item[\"name\"]}: {e}')

print(f'\\n=== {deleted}개 삭제 완료 ===')
"
else
    echo "취소됨"
fi

rm -f /tmp/remove_ids.json
