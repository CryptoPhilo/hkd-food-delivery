#!/bin/bash
# ============================================
# HKD Agent Auto-Commit Script
# 에이전트 세션에서 자동으로 feature 브랜치에 커밋
#
# 사용법: ./scripts/agent-commit.sh "변경 설명"
# 또는:   ./scripts/agent-commit.sh  (자동 메시지 생성)
# ============================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ──────────────────────────────────────
# 색상 정의
# ──────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[agent]${NC} $1"; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn(){ echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }

# ──────────────────────────────────────
# 안전 검사: main/staging 브랜치에서는 직접 커밋 금지
# ──────────────────────────────────────
CURRENT_BRANCH=$(git branch --show-current)

if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "staging" ]]; then
  err "main/staging 브랜치에서는 직접 커밋할 수 없습니다."
  log "feature 브랜치를 생성합니다..."

  # 세션 ID 또는 타임스탬프로 브랜치명 생성
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  SESSION_ID="${AGENT_SESSION_ID:-auto}"
  BRANCH_NAME="agent/${SESSION_ID}-${TIMESTAMP}"

  git checkout -b "$BRANCH_NAME"
  ok "브랜치 생성됨: $BRANCH_NAME"
  CURRENT_BRANCH="$BRANCH_NAME"
fi

# ──────────────────────────────────────
# 변경 사항 확인
# ──────────────────────────────────────
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  warn "변경 사항이 없습니다. 커밋할 것이 없습니다."
  exit 0
fi

# ──────────────────────────────────────
# 변경 파일 분석 → 자동 scope 결정
# ──────────────────────────────────────
detect_scope() {
  local files
  files=$(git diff --name-only HEAD 2>/dev/null || true)
  files="$files $(git diff --cached --name-only 2>/dev/null || true)"
  files="$files $(git ls-files --others --exclude-standard 2>/dev/null || true)"

  local has_backend=false has_frontend=false has_scrapers=false has_infra=false has_db=false

  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    case "$f" in
      architecture/backend/*) has_backend=true ;;
      architecture/frontend/*) has_frontend=true ;;
      scrapers/*|architecture/scrapers/*) has_scrapers=true ;;
      .github/*|fly.toml|Dockerfile*|docker-compose*) has_infra=true ;;
      prisma/*|supabase/migrations/*) has_db=true ;;
    esac
  done <<< "$files"

  local scopes=()
  $has_backend && scopes+=("backend")
  $has_frontend && scopes+=("frontend")
  $has_scrapers && scopes+=("scrapers")
  $has_infra && scopes+=("infra")
  $has_db && scopes+=("db")

  if [ ${#scopes[@]} -eq 1 ]; then
    echo "${scopes[0]}"
  elif [ ${#scopes[@]} -gt 1 ]; then
    echo "$(IFS=,; echo "${scopes[*]}")"
  else
    echo ""
  fi
}

detect_type() {
  local files
  files=$(git diff --name-only HEAD 2>/dev/null || true)
  files="$files $(git diff --cached --name-only 2>/dev/null || true)"
  files="$files $(git ls-files --others --exclude-standard 2>/dev/null || true)"

  # 새 파일이 대부분이면 feat, 기존 파일 수정이면 fix/refactor
  local new_count=0 mod_count=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if git ls-files --error-unmatch "$f" &>/dev/null; then
      ((mod_count++)) || true
    else
      ((new_count++)) || true
    fi
  done <<< "$files"

  if [ "$new_count" -gt "$mod_count" ]; then
    echo "feat"
  else
    echo "fix"
  fi
}

# ──────────────────────────────────────
# 커밋 메시지 구성
# ──────────────────────────────────────
SCOPE=$(detect_scope)
TYPE=$(detect_type)
USER_MSG="${1:-}"

if [ -n "$USER_MSG" ]; then
  # 사용자 메시지가 이미 conventional commit 형식이면 그대로 사용
  if echo "$USER_MSG" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?:'; then
    COMMIT_MSG="$USER_MSG"
  else
    if [ -n "$SCOPE" ]; then
      COMMIT_MSG="${TYPE}(${SCOPE}): ${USER_MSG}"
    else
      COMMIT_MSG="${TYPE}: ${USER_MSG}"
    fi
  fi
else
  # 자동 메시지 생성
  FILE_COUNT=$(git status --porcelain | wc -l | tr -d ' ')
  if [ -n "$SCOPE" ]; then
    COMMIT_MSG="${TYPE}(${SCOPE}): update ${FILE_COUNT} files via agent"
  else
    COMMIT_MSG="${TYPE}: update ${FILE_COUNT} files via agent"
  fi
fi

# 72자 제한
COMMIT_MSG=$(echo "$COMMIT_MSG" | cut -c1-72)

# ──────────────────────────────────────
# 위험 파일 검사
# ──────────────────────────────────────
DANGEROUS_PATTERNS=(".env" "credentials" "secret" "private_key" "id_rsa" ".pem")
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)
ALL_CHANGES=$(git status --porcelain | awk '{print $2}')

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if echo "$f" | grep -qi "$pattern"; then
      err "위험 파일 감지: $f (패턴: $pattern)"
      err "이 파일은 커밋에서 제외됩니다."
      git reset HEAD -- "$f" 2>/dev/null || true
      # .gitignore에 없으면 경고
      if ! git check-ignore -q "$f" 2>/dev/null; then
        warn "$f 가 .gitignore에 없습니다. 추가를 권장합니다."
      fi
    fi
  done <<< "$ALL_CHANGES"
done

# ──────────────────────────────────────
# 스테이징 & 커밋
# ──────────────────────────────────────
log "변경 사항 스테이징..."

# .env, secrets 등 제외하고 add
git add -A
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  git diff --cached --name-only | grep -i "$pattern" | while read -r f; do
    git reset HEAD -- "$f" 2>/dev/null || true
    warn "제외됨: $f"
  done
done

log "커밋 중: $COMMIT_MSG"

# --no-verify로 pre-commit 훅 우회 (에이전트 자동 커밋 시)
# 대신 CI에서 검증
git commit --no-verify -m "$COMMIT_MSG

Co-Authored-By: Claude Agent <noreply@anthropic.com>"

ok "커밋 완료: $COMMIT_MSG"

# ──────────────────────────────────────
# 자동 푸시
# ──────────────────────────────────────
log "원격에 푸시 중..."
git push -u origin "$CURRENT_BRANCH" 2>/dev/null || git push origin "$CURRENT_BRANCH"
ok "푸시 완료: $CURRENT_BRANCH"

# ──────────────────────────────────────
# 결과 출력
# ──────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Agent 커밋 완료"
echo "  브랜치: $CURRENT_BRANCH"
echo "  메시지: $COMMIT_MSG"
echo "  커밋:   $(git rev-parse --short HEAD)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
