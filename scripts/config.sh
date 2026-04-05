#!/bin/bash
# HKD 공통 설정 - 모든 스크립트에서 source 하여 사용
# Usage: source "$(dirname "$0")/config.sh"

# .env 파일 로드
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | grep -v '^$' | xargs)
fi

# 필수 환경변수 검증
validate_env() {
    local missing=()
    for var in "$@"; do
        if [ -z "${!var}" ]; then
            missing+=("$var")
        fi
    done
    if [ ${#missing[@]} -gt 0 ]; then
        echo "ERROR: 다음 환경변수가 설정되지 않았습니다: ${missing[*]}"
        echo "       .env 파일을 확인하거나 환경변수를 설정해주세요."
        echo "       참고: cp .env.example .env"
        exit 1
    fi
}

# 공통 설정
ADMIN_URL="${ADMIN_URL:-https://hkd-backend.fly.dev/api/v1/admin/restaurants}"
DATA_DIR="$PROJECT_ROOT/data"

# 지역 필터 설정
JEJU_KEYWORDS=("제주")
SEARCH_KEYWORDS=(
    "한경면 음식점" "한경면 맛집" "한경면 카페" "한경면 분식"
    "저지리 음식점" "판포리 음식점" "고산리 음식점" "신창리 음식점"
    "협재 음식점" "한림 음식점" "한경면 치킨" "한경면 중국집"
    "한경면 횟집" "한경면 고기" "협재 카페" "한림 카페"
    "협재 맛집" "한림 맛집"
)
