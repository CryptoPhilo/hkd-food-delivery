#!/bin/bash
# 이미 등록된 식당을 제외하고 나머지만 등록 (딜레이 포함)

# 환경변수에서 키 로드
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

ADMIN_URL="${ADMIN_URL:-https://hkd-backend.fly.dev/api/v1/admin/restaurants}"
ADMIN_KEY="${ADMIN_API_KEY:?'ADMIN_API_KEY 환경변수가 설정되지 않았습니다.'}"

# 1. 이미 등록된 식당 이름 목록 가져오기
echo "기존 등록된 식당 확인 중..."
EXISTING=$(curl -s -H "X-Admin-Key: $ADMIN_KEY" "$ADMIN_URL?limit=500")
EXISTING_NAMES=$(echo "$EXISTING" | python3 -c "
import sys, json
data = json.load(sys.stdin)
names = [r['name'] for r in data.get('data', [])]
print('\n'.join(names))
")
EXISTING_COUNT=$(echo "$EXISTING_NAMES" | wc -l | tr -d ' ')
echo "  이미 등록: ${EXISTING_COUNT}개"
echo ""

# 2. 미등록 식당만 필터링
python3 -c "
import json, sys

with open('collected_restaurants.json','r') as f:
    all_restaurants = json.load(f)

existing = set('''$EXISTING_NAMES'''.strip().split('\n'))

remaining = [r for r in all_restaurants if r['name'] not in existing]
print(f'미등록 식당: {len(remaining)}개')

for i, r in enumerate(remaining):
    with open(f'/tmp/remain_{i}.json','w') as out:
        json.dump(r, out, ensure_ascii=False)

with open('/tmp/remain_count.txt','w') as f:
    f.write(str(len(remaining)))
"

TOTAL=$(cat /tmp/remain_count.txt)
echo "  $TOTAL 개 식당 등록 시작 (0.3초 간격)"
echo ""

SUCCESS=0
FAIL=0
IDX=0

while [ $IDX -lt $TOTAL ]; do
    NAME=$(python3 -c "import json; print(json.load(open('/tmp/remain_${IDX}.json'))['name'])")

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ADMIN_URL" \
        -H "Content-Type: application/json" \
        -H "X-Admin-Key: $ADMIN_KEY" \
        -d @"/tmp/remain_${IDX}.json")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        SUCCESS=$((SUCCESS + 1))
        echo "  [$((IDX+1))/$TOTAL] OK $NAME"
    else
        FAIL=$((FAIL + 1))
        echo "  [$((IDX+1))/$TOTAL] FAIL $NAME ($HTTP_CODE)"
    fi

    IDX=$((IDX + 1))
    sleep 10
done

rm -f /tmp/remain_*.json /tmp/remain_count.txt

echo ""
echo "=== 완료: ${SUCCESS}개 추가 등록, ${FAIL}개 실패 ==="
echo "=== 총 등록: $((EXISTING_COUNT + SUCCESS))개 ==="
