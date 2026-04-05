#!/bin/bash
# collected_restaurants.json → Admin API 일괄 등록 (curl 사용)

# 환경변수에서 키 로드
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

ADMIN_URL="${ADMIN_URL:-https://hkd-backend.fly.dev/api/v1/admin/restaurants}"
ADMIN_KEY="${ADMIN_API_KEY:?'ADMIN_API_KEY 환경변수가 설정되지 않았습니다.'}"

if [ ! -f collected_restaurants.json ]; then
    echo "collected_restaurants.json 파일이 없습니다."
    exit 1
fi

TOTAL=$(python3 -c "import json; print(len(json.load(open('collected_restaurants.json'))))")
echo "=== $TOTAL 개 식당 일괄 등록 시작 ==="
echo ""

SUCCESS=0
FAIL=0
IDX=0

# python3으로 JSON 배열의 각 항목을 개별 파일로 분리
python3 -c "
import json
with open('collected_restaurants.json','r') as f:
    data = json.load(f)
for i, r in enumerate(data):
    with open(f'/tmp/rest_{i}.json','w') as out:
        json.dump(r, out, ensure_ascii=False)
print(len(data))
" > /dev/null

while [ $IDX -lt $TOTAL ]; do
    NAME=$(python3 -c "import json; print(json.load(open('/tmp/rest_${IDX}.json'))['name'])")

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ADMIN_URL" \
        -H "Content-Type: application/json" \
        -H "X-Admin-Key: $ADMIN_KEY" \
        -d @"/tmp/rest_${IDX}.json")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        SUCCESS=$((SUCCESS + 1))
        echo "  [$((IDX+1))/$TOTAL] OK $NAME"
    else
        FAIL=$((FAIL + 1))
        ERROR=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "$HTTP_CODE")
        echo "  [$((IDX+1))/$TOTAL] FAIL $NAME: $ERROR"
    fi

    IDX=$((IDX + 1))
done

# 임시 파일 정리
rm -f /tmp/rest_*.json

echo ""
echo "=== 완료: ${SUCCESS}개 성공, ${FAIL}개 실패 (총 ${TOTAL}개) ==="
