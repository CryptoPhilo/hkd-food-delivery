#!/bin/bash
# HKD 공통 유틸리티 함수
# Usage: source "$(dirname "$0")/utils.sh"

# 타임스탬프 로깅
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log_info() {
    log "INFO: $*"
}

log_warn() {
    log "WARN: $*"
}

log_error() {
    log "ERROR: $*" >&2
}

# API 호출 래퍼 (에러 핸들링 포함)
api_call() {
    local method="$1"
    local url="$2"
    local data="$3"
    local admin_key="$4"

    local response
    local http_code

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -H "X-Admin-Key: $admin_key" \
            "$url")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "X-Admin-Key: $admin_key" \
            -d "$data" \
            "$url")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE \
            -H "X-Admin-Key: $admin_key" \
            "$url")
    fi

    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "$body"
        return 0
    else
        log_error "API 호출 실패: $method $url (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

# 백업 생성
create_backup() {
    local file="$1"
    local backup_dir="${2:-/tmp/hkd_backups}"
    mkdir -p "$backup_dir"
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$backup_dir/$(basename "$file")_${timestamp}.bak"
    cp "$file" "$backup_file" 2>/dev/null && echo "$backup_file"
}

# JSON 배열 길이 확인
json_array_length() {
    python3 -c "import json,sys; print(len(json.load(sys.stdin)))" < "$1" 2>/dev/null || echo "0"
}
