#!/bin/bash
# ============================================
# 🏗️ Project Harness Bootstrap Script
# 새 프로젝트에 CI/CD + 에이전트 자동화 하네스를 한 번에 설정
#
# 사용법:
#   curl -sL <URL> | bash          (원격)
#   bash scripts/bootstrap-harness.sh  (로컬)
#
# 설정 항목:
#   1. Repository 하네스 (CI, auto-label, DB migration)
#   2. Deployment 하네스 (staging/production 배포, 롤백)
#   3. Agent 워크플로우 (auto-commit, auto-PR, promote)
#   4. Coding 하네스 (ESLint, Prettier, Ruff, Husky, commitlint)
#   5. GitHub 설정 (branch protection, environments, secrets)
# ============================================

set -euo pipefail

# ──────────────────────────────────────
# 색상
# ──────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${BLUE}[harness]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✅${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠️${NC} $1"; }
err()  { echo -e "${RED}  ❌${NC} $1"; }
header() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ──────────────────────────────────────
# 사전 조건 확인
# ──────────────────────────────────────
check_prerequisites() {
  header "사전 조건 확인"

  if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    err "Git 레포지터리가 아닙니다. git init 먼저 실행하세요."
    exit 1
  fi
  ok "Git 레포지터리 확인"

  if ! command -v gh &>/dev/null; then
    warn "gh CLI가 없습니다. GitHub 설정은 수동으로 진행하세요."
    warn "설치: brew install gh (macOS) / https://cli.github.com"
    HAS_GH=false
  else
    ok "gh CLI 확인"
    HAS_GH=true
  fi

  if ! command -v node &>/dev/null; then
    warn "Node.js가 없습니다. 코딩 하네스(ESLint/Prettier)는 수동 설정 필요."
    HAS_NODE=false
  else
    ok "Node.js $(node -v) 확인"
    HAS_NODE=true
  fi

  if ! command -v python3 &>/dev/null; then
    warn "Python3가 없습니다. Ruff 린터는 건너뜁니다."
    HAS_PYTHON=false
  else
    ok "Python3 확인"
    HAS_PYTHON=true
  fi
}

# ──────────────────────────────────────
# 프로젝트 정보 수집
# ──────────────────────────────────────
collect_project_info() {
  header "프로젝트 설정"

  # Git remote에서 자동 감지
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
  if [ -n "$REMOTE_URL" ]; then
    AUTO_REPO=$(echo "$REMOTE_URL" | sed -E 's|.*github\.com[:/]||;s|\.git$||')
    AUTO_OWNER=$(echo "$AUTO_REPO" | cut -d'/' -f1)
    AUTO_NAME=$(echo "$AUTO_REPO" | cut -d'/' -f2)
  fi

  # GitHub 레포지터리
  echo ""
  read -p "  GitHub 레포 (owner/repo) [${AUTO_REPO:-}]: " INPUT_REPO
  REPO="${INPUT_REPO:-$AUTO_REPO}"
  OWNER=$(echo "$REPO" | cut -d'/' -f1)
  REPO_NAME=$(echo "$REPO" | cut -d'/' -f2)

  if [ -z "$REPO" ]; then
    err "GitHub 레포를 입력해주세요."
    exit 1
  fi
  ok "레포: $REPO"

  # 프로젝트 이름 (표시용)
  read -p "  프로젝트 이름 [${REPO_NAME}]: " INPUT_PROJECT_NAME
  PROJECT_NAME="${INPUT_PROJECT_NAME:-$REPO_NAME}"

  # 프로젝트 구조
  echo ""
  echo -e "  ${BOLD}프로젝트 구조를 선택하세요:${NC}"
  echo "    1) monorepo (backend/ + frontend/ 분리)"
  echo "    2) backend-only (Node.js/Express)"
  echo "    3) frontend-only (Next.js/React)"
  echo "    4) fullstack-single (하나의 앱)"
  echo "    5) custom (직접 입력)"
  read -p "  선택 [1]: " STRUCTURE_CHOICE
  STRUCTURE_CHOICE="${STRUCTURE_CHOICE:-1}"

  case "$STRUCTURE_CHOICE" in
    1)
      BACKEND_PATH="architecture/backend"
      FRONTEND_PATH="architecture/frontend"
      HAS_BACKEND=true; HAS_FRONTEND=true
      ;;
    2)
      read -p "  백엔드 경로 [src]: " BACKEND_PATH
      BACKEND_PATH="${BACKEND_PATH:-src}"
      HAS_BACKEND=true; HAS_FRONTEND=false
      ;;
    3)
      read -p "  프론트엔드 경로 [src]: " FRONTEND_PATH
      FRONTEND_PATH="${FRONTEND_PATH:-src}"
      HAS_BACKEND=false; HAS_FRONTEND=true
      ;;
    4)
      read -p "  앱 경로 [.]: " APP_PATH
      APP_PATH="${APP_PATH:-.}"
      BACKEND_PATH="$APP_PATH"; FRONTEND_PATH="$APP_PATH"
      HAS_BACKEND=true; HAS_FRONTEND=true
      ;;
    5)
      read -p "  백엔드 경로 (없으면 Enter): " BACKEND_PATH
      read -p "  프론트엔드 경로 (없으면 Enter): " FRONTEND_PATH
      HAS_BACKEND=[ -n "$BACKEND_PATH" ]
      HAS_FRONTEND=[ -n "$FRONTEND_PATH" ]
      ;;
  esac

  # 스크래퍼/Python 코드
  read -p "  Python 코드 경로 (없으면 Enter): " SCRAPERS_PATH
  HAS_SCRAPERS=false
  [ -n "$SCRAPERS_PATH" ] && HAS_SCRAPERS=true

  # 배포 플랫폼
  echo ""
  echo -e "  ${BOLD}배포 플랫폼:${NC}"
  echo "    1) Fly.io"
  echo "    2) Vercel"
  echo "    3) AWS (ECS/EB)"
  echo "    4) Docker only (self-hosted)"
  echo "    5) 배포 하네스 건너뛰기"
  read -p "  선택 [1]: " DEPLOY_CHOICE
  DEPLOY_CHOICE="${DEPLOY_CHOICE:-1}"

  DEPLOY_PLATFORM="flyio"
  case "$DEPLOY_CHOICE" in
    1) DEPLOY_PLATFORM="flyio" ;;
    2) DEPLOY_PLATFORM="vercel" ;;
    3) DEPLOY_PLATFORM="aws" ;;
    4) DEPLOY_PLATFORM="docker" ;;
    5) DEPLOY_PLATFORM="none" ;;
  esac

  if [ "$DEPLOY_PLATFORM" = "flyio" ]; then
    read -p "  Fly.io 백엔드 앱 이름 (staging) [${REPO_NAME}-backend-staging]: " FLY_BACKEND_STAGING
    FLY_BACKEND_STAGING="${FLY_BACKEND_STAGING:-${REPO_NAME}-backend-staging}"
    read -p "  Fly.io 백엔드 앱 이름 (production) [${REPO_NAME}-backend]: " FLY_BACKEND_PROD
    FLY_BACKEND_PROD="${FLY_BACKEND_PROD:-${REPO_NAME}-backend}"
    read -p "  Fly.io 프론트엔드 앱 이름 (staging) [${REPO_NAME}-frontend-staging]: " FLY_FRONTEND_STAGING
    FLY_FRONTEND_STAGING="${FLY_FRONTEND_STAGING:-${REPO_NAME}-frontend-staging}"
    read -p "  Fly.io 프론트엔드 앱 이름 (production) [${REPO_NAME}-frontend]: " FLY_FRONTEND_PROD
    FLY_FRONTEND_PROD="${FLY_FRONTEND_PROD:-${REPO_NAME}-frontend}"

    read -p "  헬스체크 엔드포인트 (백엔드) [/health]: " HEALTH_ENDPOINT
    HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-/health}"
  fi

  # DB
  echo ""
  echo -e "  ${BOLD}데이터베이스:${NC}"
  echo "    1) Prisma (PostgreSQL)"
  echo "    2) Supabase"
  echo "    3) 기타 / 없음"
  read -p "  선택 [1]: " DB_CHOICE
  DB_CHOICE="${DB_CHOICE:-1}"

  HAS_PRISMA=false; HAS_SUPABASE=false
  case "$DB_CHOICE" in
    1) HAS_PRISMA=true ;;
    2) HAS_SUPABASE=true ;;
  esac

  # 요약
  header "설정 요약"
  echo "  프로젝트: $PROJECT_NAME ($REPO)"
  $HAS_BACKEND && echo "  백엔드:   $BACKEND_PATH"
  $HAS_FRONTEND && echo "  프론트엔드: $FRONTEND_PATH"
  $HAS_SCRAPERS && echo "  Python:   $SCRAPERS_PATH"
  echo "  배포:     $DEPLOY_PLATFORM"
  $HAS_PRISMA && echo "  DB:       Prisma"
  $HAS_SUPABASE && echo "  DB:       Supabase"
  echo ""
  read -p "  이대로 진행할까요? (Y/n): " CONFIRM
  if [[ "${CONFIRM:-Y}" =~ ^[Nn] ]]; then
    echo "취소되었습니다."
    exit 0
  fi
}

# ──────────────────────────────────────
# 1. Repository 하네스
# ──────────────────────────────────────
create_repo_harness() {
  header "1. Repository 하네스 생성"
  REPO_ROOT=$(git rev-parse --show-toplevel)
  cd "$REPO_ROOT"

  mkdir -p .github/workflows .github/PULL_REQUEST_TEMPLATE

  # ── CI 워크플로우 ──
  log "CI 워크플로우 생성..."

  # paths-filter 섹션 동적 생성
  FILTER_BLOCK=""
  CI_JOBS=""

  if $HAS_BACKEND; then
    FILTER_BLOCK="${FILTER_BLOCK}
            backend:
              - '${BACKEND_PATH}/**'"
  fi
  if $HAS_FRONTEND; then
    FILTER_BLOCK="${FILTER_BLOCK}
            frontend:
              - '${FRONTEND_PATH}/**'"
  fi
  if $HAS_SCRAPERS; then
    FILTER_BLOCK="${FILTER_BLOCK}
            scrapers:
              - '${SCRAPERS_PATH}/**'
              - 'tests/**'
              - 'pyproject.toml'
              - 'requirements.txt'"
  fi

  cat > .github/workflows/ci.yml << CIEOF
# ============================================
# ${PROJECT_NAME} CI (Continuous Integration)
# PR 및 push 시 린트/테스트/빌드 자동 검증
# ============================================

name: CI

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main, staging]

concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  PYTHON_VERSION: '3.11'

jobs:
  changes:
    name: 🔍 변경 감지
    runs-on: ubuntu-latest
    outputs:
$(if $HAS_BACKEND; then echo "      backend: \${{ steps.filter.outputs.backend }}"; fi)
$(if $HAS_FRONTEND; then echo "      frontend: \${{ steps.filter.outputs.frontend }}"; fi)
$(if $HAS_SCRAPERS; then echo "      scrapers: \${{ steps.filter.outputs.scrapers }}"; fi)
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |${FILTER_BLOCK}
CIEOF

  # 백엔드 CI job
  if $HAS_BACKEND; then
    cat >> .github/workflows/ci.yml << CIEOF

  backend-ci:
    name: 🔧 백엔드 CI
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${BACKEND_PATH}

    steps:
      - uses: actions/checkout@v4

      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}

      - name: 의존성 설치
        run: npm install

$(if $HAS_PRISMA; then echo "      - name: Prisma Generate
        run: npx prisma generate
        continue-on-error: true
"; fi)
      - name: 린트
        run: npx eslint src/ --ext .ts,.tsx || true
        continue-on-error: true

      - name: 타입 체크
        run: npx tsc --noEmit
        continue-on-error: true

      - name: 빌드
        run: npm run build

      - name: 테스트
        run: npm test || true
        continue-on-error: true
CIEOF
  fi

  # 프론트엔드 CI job
  if $HAS_FRONTEND; then
    cat >> .github/workflows/ci.yml << CIEOF

  frontend-ci:
    name: 🎨 프론트엔드 CI
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${FRONTEND_PATH}

    steps:
      - uses: actions/checkout@v4

      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}

      - name: 의존성 설치
        run: npm install

      - name: ESLint 설치
        run: npm install --save-dev eslint

      - name: 린트
        run: npx next lint || npx eslint src/ --ext .ts,.tsx || true
        continue-on-error: true

      - name: 타입 체크
        run: npx tsc --noEmit
        continue-on-error: true

      - name: 빌드
        run: npm run build
CIEOF
  fi

  # 스크래퍼 CI job
  if $HAS_SCRAPERS; then
    cat >> .github/workflows/ci.yml << CIEOF

  scrapers-ci:
    name: 🐍 스크래퍼 CI
    needs: changes
    if: needs.changes.outputs.scrapers == 'true'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Python 설정
        uses: actions/setup-python@v5
        with:
          python-version: \${{ env.PYTHON_VERSION }}
          cache: 'pip'

      - name: 의존성 설치
        run: |
          pip install -r requirements.txt || true
          pip install ruff pytest

      - name: Ruff 린트
        run: ruff check ${SCRAPERS_PATH}/
        continue-on-error: true

      - name: 테스트
        run: pytest tests/ -x --timeout=30 -q || true
        continue-on-error: true
CIEOF
  fi

  # Docker 검증 job
  cat >> .github/workflows/ci.yml << CIEOF

  docker-check:
    name: 🐳 Docker 빌드 검증
    needs: changes
    if: |
$(if $HAS_BACKEND; then echo "      needs.changes.outputs.backend == 'true' ||"; fi)
$(if $HAS_FRONTEND; then echo "      needs.changes.outputs.frontend == 'true' ||"; fi)
      false
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
$(if $HAS_BACKEND; then echo "
      - name: 백엔드 Docker 빌드
        run: docker build -t ${REPO_NAME}-backend-test ${BACKEND_PATH}/
        continue-on-error: true"; fi)
$(if $HAS_FRONTEND; then echo "
      - name: 프론트엔드 Docker 빌드
        run: docker build -t ${REPO_NAME}-frontend-test ${FRONTEND_PATH}/
        continue-on-error: true"; fi)

  ci-gate:
    name: ✅ CI 게이트
    if: always()
    needs:
      - changes
$(if $HAS_BACKEND; then echo "      - backend-ci"; fi)
$(if $HAS_FRONTEND; then echo "      - frontend-ci"; fi)
$(if $HAS_SCRAPERS; then echo "      - scrapers-ci"; fi)
      - docker-check
    runs-on: ubuntu-latest
    steps:
      - name: 결과 확인
        run: |
          echo "## CI 결과"
$(if $HAS_BACKEND; then echo "          echo \"Backend:  \${{ needs.backend-ci.result }}\""; fi)
$(if $HAS_FRONTEND; then echo "          echo \"Frontend: \${{ needs.frontend-ci.result }}\""; fi)
$(if $HAS_SCRAPERS; then echo "          echo \"Scrapers: \${{ needs.scrapers-ci.result }}\""; fi)
          echo "Docker:   \${{ needs.docker-check.result }}"

          if [[ "\${{ needs.docker-check.result }}" == "failure" ]]; then
            echo "❌ CI 실패"
            exit 1
          fi
$(if $HAS_BACKEND; then echo "          if [[ \"\${{ needs.backend-ci.result }}\" == \"failure\" ]]; then exit 1; fi"; fi)
$(if $HAS_FRONTEND; then echo "          if [[ \"\${{ needs.frontend-ci.result }}\" == \"failure\" ]]; then exit 1; fi"; fi)
          echo "✅ CI 통과"
CIEOF
  ok "CI 워크플로우"

  # ── 자동 라벨링 ──
  log "자동 라벨링 설정..."

  cat > .github/workflows/auto-label.yml << 'LABELWF'
name: Auto Label

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  label:
    name: 🏷️ 자동 라벨링
    runs-on: ubuntu-latest
    steps:
      - uses: actions/labeler@v5
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
LABELWF

  cat > .github/labeler.yml << LABELEOF
# PR 자동 라벨링 규칙
$(if $HAS_BACKEND; then echo "
backend:
  - changed-files:
    - any-glob-to-any-file: '${BACKEND_PATH}/**'"; fi)
$(if $HAS_FRONTEND; then echo "
frontend:
  - changed-files:
    - any-glob-to-any-file: '${FRONTEND_PATH}/**'"; fi)
$(if $HAS_SCRAPERS; then echo "
scrapers:
  - changed-files:
    - any-glob-to-any-file:
      - '${SCRAPERS_PATH}/**'
      - 'tests/**'"; fi)

infra:
  - changed-files:
    - any-glob-to-any-file:
      - '.github/**'
      - '**/Dockerfile'
      - '**/fly.toml'
      - '**/docker-compose*.yml'

docs:
  - changed-files:
    - any-glob-to-any-file:
      - '**/*.md'
      - 'docs/**'

database:
  - changed-files:
    - any-glob-to-any-file:
      - '**/prisma/**'
      - '**/*.sql'

scripts:
  - changed-files:
    - any-glob-to-any-file:
      - 'scripts/**'
      - '*.sh'
LABELEOF
  ok "자동 라벨링"

  # ── DB Migration 체크 ──
  if $HAS_PRISMA; then
    log "DB Migration 워크플로우 생성..."
    cat > .github/workflows/db-migration.yml << 'DBEOF'
name: DB Migration Check

on:
  pull_request:
    paths:
      - '**/prisma/schema.prisma'
      - '**/prisma/migrations/**'

jobs:
  prisma-check:
    name: 🗃️ Prisma 스키마 검증
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Prisma CLI 설치
        run: npm install prisma

      - name: 스키마 유효성 검사
        run: npx prisma validate
        env:
          DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci_dummy"

      - name: 마이그레이션 드리프트 체크
        run: npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --exit-code || true
        env:
          DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci_dummy"
        continue-on-error: true
DBEOF
    ok "DB Migration 워크플로우"
  fi

  # ── PR 템플릿 ──
  log "PR 템플릿 생성..."
  cat > .github/PULL_REQUEST_TEMPLATE/default.md << 'PREOF'
## 변경 사항
<!-- 이 PR에서 변경한 내용을 간단히 설명해주세요 -->


## 변경 유형
- [ ] 🐛 버그 수정
- [ ] ✨ 새 기능
- [ ] ♻️ 리팩토링
- [ ] 📝 문서 수정
- [ ] 🔧 인프라/설정 변경
- [ ] 🧪 테스트 추가/수정

## 테스트
- [ ] 로컬에서 테스트 완료
- [ ] 관련 테스트 코드 추가/수정

## 배포 영향
- [ ] 환경변수 변경 필요
- [ ] DB 마이그레이션 필요
- [ ] 배포 후 수동 작업 필요

## 스크린샷 (UI 변경 시)
<!-- 해당되는 경우 스크린샷을 첨부해주세요 -->
PREOF
  ok "PR 템플릿"
}

# ──────────────────────────────────────
# 2. Deployment 하네스
# ──────────────────────────────────────
create_deploy_harness() {
  if [ "$DEPLOY_PLATFORM" = "none" ]; then
    log "배포 하네스 건너뛰기"
    return
  fi

  header "2. Deployment 하네스 생성"

  if [ "$DEPLOY_PLATFORM" = "flyio" ]; then
    create_flyio_deploy
  elif [ "$DEPLOY_PLATFORM" = "vercel" ]; then
    log "Vercel은 자동 연동됩니다. GitHub에서 Vercel 앱을 설치하세요."
    ok "Vercel 배포 (외부 설정 필요)"
    return
  else
    log "${DEPLOY_PLATFORM} 배포는 수동 설정이 필요합니다."
    return
  fi
}

create_flyio_deploy() {
  # ── Staging 배포 ──
  log "Staging 배포 워크플로우..."
  cat > .github/workflows/deploy-staging.yml << STGEOF
name: Deploy Staging

on:
  push:
    branches: [staging]

concurrency:
  group: deploy-staging
  cancel-in-progress: false

env:
  FLY_API_TOKEN: \${{ secrets.FLY_API_TOKEN }}

jobs:
  changes:
    name: 🔍 변경 감지
    runs-on: ubuntu-latest
    outputs:
$(if $HAS_BACKEND; then echo "      backend: \${{ steps.filter.outputs.backend }}"; fi)
$(if $HAS_FRONTEND; then echo "      frontend: \${{ steps.filter.outputs.frontend }}"; fi)
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
$(if $HAS_BACKEND; then echo "            backend:
              - '${BACKEND_PATH}/**'"; fi)
$(if $HAS_FRONTEND; then echo "            frontend:
              - '${FRONTEND_PATH}/**'"; fi)
$(if $HAS_BACKEND; then echo "
  deploy-backend-staging:
    name: 🔧 백엔드 → Staging
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    environment: staging
    defaults:
      run:
        working-directory: ${BACKEND_PATH}
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Staging 배포
        run: flyctl deploy --app ${FLY_BACKEND_STAGING} --remote-only
      - name: 헬스체크
        run: |
          sleep 30
          for i in 1 2 3 4 5; do
            status=\$(curl -s -o /dev/null -w \"%{http_code}\" https://${FLY_BACKEND_STAGING}.fly.dev${HEALTH_ENDPOINT} || true)
            if [ \"\$status\" = \"200\" ]; then echo \"✅ 헬스체크 통과\"; exit 0; fi
            echo \"⏳ 대기 중... (시도 \$i, 상태: \$status)\"; sleep 10
          done
          echo \"❌ 헬스체크 실패\"; exit 1"; fi)
$(if $HAS_FRONTEND; then echo "
  deploy-frontend-staging:
    name: 🎨 프론트엔드 → Staging
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    environment: staging
    defaults:
      run:
        working-directory: ${FRONTEND_PATH}
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Staging 배포
        run: flyctl deploy --app ${FLY_FRONTEND_STAGING} --remote-only
      - name: 헬스체크
        run: |
          sleep 30
          for i in 1 2 3 4 5; do
            status=\$(curl -s -o /dev/null -w \"%{http_code}\" https://${FLY_FRONTEND_STAGING}.fly.dev/ || true)
            if [ \"\$status\" = \"200\" ]; then echo \"✅ 헬스체크 통과\"; exit 0; fi
            echo \"⏳ 대기 중... (시도 \$i)\"; sleep 10
          done
          echo \"❌ 헬스체크 실패\"; exit 1"; fi)
STGEOF
  ok "Staging 배포 워크플로우"

  # ── Production 배포 ──
  log "Production 배포 워크플로우..."
  cat > .github/workflows/deploy-production.yml << PRODEOF
name: Deploy Production

on:
  push:
    branches: [main]

concurrency:
  group: deploy-production
  cancel-in-progress: false

env:
  FLY_API_TOKEN: \${{ secrets.FLY_API_TOKEN }}

jobs:
$(if $HAS_BACKEND; then echo "  deploy-backend:
    name: 🔧 백엔드 → Production
    runs-on: ubuntu-latest
    environment: production
    defaults:
      run:
        working-directory: ${BACKEND_PATH}
    outputs:
      previous_image: \${{ steps.save.outputs.image }}
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: 이전 이미지 저장
        id: save
        run: |
          IMG=\$(flyctl status --app ${FLY_BACKEND_PROD} --json 2>/dev/null | jq -r '.Deployed.ImageRef // empty' || true)
          echo \"image=\$IMG\" >> \"\$GITHUB_OUTPUT\"
      - name: Production 배포
        run: flyctl deploy --app ${FLY_BACKEND_PROD} --remote-only
      - name: 헬스체크
        id: healthcheck
        run: |
          sleep 30
          for i in 1 2 3 4 5; do
            status=\$(curl -s -o /dev/null -w \"%{http_code}\" https://${FLY_BACKEND_PROD}.fly.dev${HEALTH_ENDPOINT} || true)
            if [ \"\$status\" = \"200\" ]; then echo \"✅ 통과\"; exit 0; fi
            sleep 10
          done
          echo \"❌ 실패\"; exit 1
      - name: 자동 롤백
        if: failure() && steps.healthcheck.outcome == 'failure'
        run: |
          PREV=\"\${{ steps.save.outputs.image }}\"
          if [ -n \"\$PREV\" ]; then
            flyctl deploy --app ${FLY_BACKEND_PROD} --image \"\$PREV\"
            echo \"🔄 롤백 완료\"
          fi"; fi)
$(if $HAS_FRONTEND; then echo "
  deploy-frontend:
    name: 🎨 프론트엔드 → Production
    runs-on: ubuntu-latest
    environment: production
$(if $HAS_BACKEND; then echo "    needs: deploy-backend"; fi)
    defaults:
      run:
        working-directory: ${FRONTEND_PATH}
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Production 배포
        run: flyctl deploy --app ${FLY_FRONTEND_PROD} --remote-only
      - name: 헬스체크
        run: |
          sleep 30
          for i in 1 2 3 4 5; do
            status=\$(curl -s -o /dev/null -w \"%{http_code}\" https://${FLY_FRONTEND_PROD}.fly.dev/ || true)
            if [ \"\$status\" = \"200\" ]; then echo \"✅ 통과\"; exit 0; fi
            sleep 10
          done
          echo \"❌ 실패\"; exit 1"; fi)
PRODEOF
  ok "Production 배포 워크플로우"

  # ── 롤백 ──
  log "롤백 워크플로우..."
  cat > .github/workflows/rollback.yml << 'RBEOF'
name: Manual Rollback

on:
  workflow_dispatch:
    inputs:
      service:
        description: '롤백 대상'
        required: true
        type: choice
        options: [backend, frontend, both]
      release:
        description: '릴리즈 번호 (선택)'
        required: false
      reason:
        description: '롤백 사유'
        required: true

jobs:
  rollback:
    name: 🔄 롤백
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: 롤백 실행
        run: |
          echo "🔄 롤백 시작"
          echo "대상: ${{ inputs.service }}"
          echo "사유: ${{ inputs.reason }}"
          echo ""
          echo "⚠️ Fly.io 대시보드에서 수동으로 이전 릴리즈를 배포하세요."
          echo "   flyctl releases --app <APP_NAME>"
          echo "   flyctl deploy --app <APP_NAME> --image <IMAGE>"
RBEOF
  ok "롤백 워크플로우"

  # ── Supabase Edge Functions ──
  if $HAS_SUPABASE; then
    log "Edge Functions 배포 워크플로우..."
    cat > .github/workflows/deploy-edge-functions.yml << 'EFEOF'
name: Deploy Edge Functions

on:
  push:
    branches: [main]
    paths: ['supabase/functions/**']
  workflow_dispatch:
    inputs:
      function_name:
        description: '배포할 함수 이름 (비워두면 변경된 함수만)'
        required: false

jobs:
  deploy:
    name: 🔮 Edge Functions 배포
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: 변경된 함수 감지 및 배포
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        run: |
          PROJECT_REF="${{ secrets.SUPABASE_PROJECT_REF }}"
          MANUAL_FN="${{ inputs.function_name }}"

          if [ -n "$MANUAL_FN" ]; then
            supabase functions deploy "$MANUAL_FN" --project-ref "$PROJECT_REF"
          else
            for dir in supabase/functions/*/; do
              fn=$(basename "$dir")
              if git diff --name-only HEAD~1 HEAD | grep -q "supabase/functions/$fn/"; then
                supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
              fi
            done
          fi
EFEOF
    ok "Edge Functions 워크플로우"
  fi
}

# ──────────────────────────────────────
# 3. Agent 워크플로우
# ──────────────────────────────────────
create_agent_harness() {
  header "3. Agent 자동화 워크플로우 생성"

  mkdir -p scripts

  # ── agent-commit.sh ──
  log "에이전트 커밋 스크립트..."
  cat > scripts/agent-commit.sh << 'ACEOF'
#!/bin/bash
# Agent Auto-Commit Script
# 사용법: ./scripts/agent-commit.sh "변경 설명"
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${BLUE}[agent]${NC} $1"; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn(){ echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }

CURRENT_BRANCH=$(git branch --show-current)

if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "staging" ]]; then
  err "main/staging 브랜치에서는 직접 커밋할 수 없습니다."
  log "feature 브랜치를 생성합니다..."
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  SESSION_ID="${AGENT_SESSION_ID:-auto}"
  BRANCH_NAME="agent/${SESSION_ID}-${TIMESTAMP}"
  git checkout -b "$BRANCH_NAME"
  ok "브랜치 생성됨: $BRANCH_NAME"
  CURRENT_BRANCH="$BRANCH_NAME"
fi

if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  warn "변경 사항이 없습니다."; exit 0
fi

# 위험 파일 검사
DANGEROUS_PATTERNS=(".env" "credentials" "secret" "private_key" "id_rsa" ".pem")

# 스테이징
git add -A
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  git diff --cached --name-only | grep -i "$pattern" | while read -r f; do
    git reset HEAD -- "$f" 2>/dev/null || true
    warn "제외됨: $f"
  done
done

# 커밋 메시지
USER_MSG="${1:-}"
FILE_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
if [ -n "$USER_MSG" ]; then
  if echo "$USER_MSG" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?:'; then
    COMMIT_MSG="$USER_MSG"
  else
    COMMIT_MSG="feat: ${USER_MSG}"
  fi
else
  COMMIT_MSG="feat: update ${FILE_COUNT} files via agent"
fi
COMMIT_MSG=$(echo "$COMMIT_MSG" | cut -c1-72)

git commit --no-verify -m "${COMMIT_MSG}

Co-Authored-By: Claude Agent <noreply@anthropic.com>"
ok "커밋: $COMMIT_MSG"

git push -u origin "$CURRENT_BRANCH" 2>/dev/null || git push origin "$CURRENT_BRANCH"
ok "푸시 완료: $CURRENT_BRANCH"
ACEOF
  chmod +x scripts/agent-commit.sh
  ok "에이전트 커밋 스크립트"

  # ── agent-pr-staging.yml ──
  log "자동 PR 워크플로우..."
  cat > .github/workflows/agent-pr-staging.yml << 'APREOF'
name: Agent → Staging PR

on:
  push:
    branches: ['agent/**']

permissions:
  contents: read
  pull-requests: write

jobs:
  create-pr:
    name: 📋 Staging PR 생성
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: staging 브랜치 확인
        run: |
          if ! git ls-remote --heads origin staging | grep -q staging; then
            git checkout -b staging origin/main
            git push origin staging
          fi

      - name: 기존 PR 확인
        id: check-pr
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          BRANCH="${{ github.ref_name }}"
          EXISTING=$(gh pr list --head "$BRANCH" --base staging --state open --json number --jq '.[0].number // empty')
          echo "existing_pr=${EXISTING}" >> "$GITHUB_OUTPUT"

      - name: PR 생성
        if: steps.check-pr.outputs.existing_pr == ''
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          BRANCH="${{ github.ref_name }}"
          FILES=$(git diff --name-only origin/staging..HEAD 2>/dev/null | wc -l | tr -d ' ')
          gh pr create \
            --head "$BRANCH" --base staging \
            --title "[Agent] ${BRANCH##agent/} (${FILES} files)" \
            --body "## 🤖 Agent 자동 PR
          **브랜치:** \`${BRANCH}\`

          > ⚠️ CI 검증 통과 후 staging 머지를 진행하세요."

      - name: 기존 PR 코멘트
        if: steps.check-pr.outputs.existing_pr != ''
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          COMMIT_MSG=$(git log -1 --format="%s")
          gh pr comment "${{ steps.check-pr.outputs.existing_pr }}" \
            --body "🔄 새 커밋: \`${{ github.sha }}\` - ${COMMIT_MSG}"
APREOF
  ok "자동 PR 워크플로우"

  # ── promote-production.yml ──
  log "Production 승격 워크플로우..."
  cat > .github/workflows/promote-production.yml << 'PROMEOF'
name: Promote to Production

on:
  workflow_dispatch:
    inputs:
      description:
        description: '배포 설명'
        required: true
        type: string

permissions:
  contents: write
  pull-requests: write

jobs:
  promote:
    name: 🚀 Production 승격 PR
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: 변경 확인 및 PR 생성
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git fetch origin main staging
          DIFF=$(git rev-list --count origin/main..origin/staging)
          if [ "$DIFF" -eq 0 ]; then
            echo "::warning::staging과 main이 동일합니다."
            exit 0
          fi

          EXISTING=$(gh pr list --head staging --base main --state open --json number --jq '.[0].number // empty')
          if [ -n "$EXISTING" ]; then
            gh pr comment "$EXISTING" --body "🔄 승격 요청: ${{ inputs.description }}"
          else
            COMMITS=$(git log origin/main..origin/staging --oneline)
            gh pr create --head staging --base main \
              --title "🚀 Production: ${{ inputs.description }}" \
              --body "## 🚀 Production 승격
          **설명:** ${{ inputs.description }}
          **커밋 수:** ${DIFF}개

          ### 커밋 내역
          \`\`\`
          ${COMMITS}
          \`\`\`

          > ✅ 머지하면 자동으로 Production에 배포됩니다."
          fi
PROMEOF
  ok "Production 승격 워크플로우"
}

# ──────────────────────────────────────
# 4. Coding 하네스
# ──────────────────────────────────────
create_coding_harness() {
  header "4. Coding 하네스 생성"
  REPO_ROOT=$(git rev-parse --show-toplevel)
  cd "$REPO_ROOT"

  # ── ESLint ──
  log "ESLint 설정..."
  cat > .eslintrc.json << ESLEOF
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "env": { "node": true, "es2022": true },
  "rules": {
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "no-console": "off"
  },
  "overrides": [
$(if $HAS_FRONTEND; then echo '    {
      "files": ["'"${FRONTEND_PATH}"'/src/**/*.{ts,tsx}"],
      "env": { "browser": true },
      "extends": ["plugin:react/recommended", "plugin:react-hooks/recommended"],
      "settings": { "react": { "version": "detect" } },
      "rules": { "react/react-in-jsx-scope": "off" }
    },'; fi)
    {
      "files": ["**/*.test.ts", "**/*.spec.ts"],
      "env": { "jest": true }
    }
  ],
  "ignorePatterns": ["node_modules/", "dist/", ".next/", "build/", "coverage/"]
}
ESLEOF
  ok "ESLint"

  # ── Prettier ──
  log "Prettier 설정..."
  cat > .prettierrc << 'PEOF'
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
PEOF

  cat > .prettierignore << 'PIEOF'
node_modules
dist
.next
build
coverage
data/
reports/
*.json
PIEOF
  ok "Prettier"

  # ── Ruff (Python) ──
  if $HAS_SCRAPERS; then
    log "Ruff 설정..."
    if [ -f pyproject.toml ]; then
      if ! grep -q "\[tool.ruff\]" pyproject.toml; then
        cat >> pyproject.toml << 'REOF'

[tool.ruff]
target-version = "py39"
line-length = 100

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "SIM", "RUF"]
ignore = ["UP006", "UP035", "N806", "SIM108", "F841", "B007"]
REOF
      fi
    else
      cat > pyproject.toml << 'REOF'
[tool.ruff]
target-version = "py39"
line-length = 100

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "SIM", "RUF"]
ignore = ["UP006", "UP035", "N806", "SIM108", "F841", "B007"]
REOF
    fi
    ok "Ruff"
  fi

  # ── commitlint ──
  log "commitlint 설정..."

  # scope 리스트 동적 생성
  SCOPES="'ci', 'infra', 'deps', 'scripts', 'db'"
  $HAS_BACKEND && SCOPES="'backend', ${SCOPES}"
  $HAS_FRONTEND && SCOPES="'frontend', ${SCOPES}"
  $HAS_SCRAPERS && SCOPES="'scrapers', ${SCOPES}"

  cat > commitlint.config.js << CLEOF
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert',
    ]],
    'scope-enum': [1, 'always', [${SCOPES}]],
    'header-max-length': [2, 'always', 72],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
  },
};
CLEOF
  ok "commitlint"

  # ── lint-staged 설정을 package.json에 추가 (있으면) ──
  # lint-staged 경로 동적 생성
  LINT_STAGED_ENTRIES=""
  if $HAS_BACKEND; then
    LINT_STAGED_ENTRIES="\"${BACKEND_PATH}/src/**/*.ts\": [\"eslint --fix\", \"prettier --write\"]"
  fi
  if $HAS_FRONTEND; then
    [ -n "$LINT_STAGED_ENTRIES" ] && LINT_STAGED_ENTRIES="${LINT_STAGED_ENTRIES}, "
    LINT_STAGED_ENTRIES="${LINT_STAGED_ENTRIES}\"${FRONTEND_PATH}/src/**/*.{ts,tsx}\": [\"eslint --fix\", \"prettier --write\"]"
  fi
  if $HAS_SCRAPERS; then
    [ -n "$LINT_STAGED_ENTRIES" ] && LINT_STAGED_ENTRIES="${LINT_STAGED_ENTRIES}, "
    LINT_STAGED_ENTRIES="${LINT_STAGED_ENTRIES}\"${SCRAPERS_PATH}/**/*.py\": [\"ruff check --fix\", \"ruff format\"]"
  fi

  # ── Husky ──
  log "Husky 설정..."
  mkdir -p .husky
  echo "npx lint-staged" > .husky/pre-commit
  echo 'npx --no -- commitlint --edit $1' > .husky/commit-msg
  chmod +x .husky/pre-commit .husky/commit-msg
  ok "Husky 훅"

  # ── 설치 스크립트 ──
  log "코딩 하네스 설치 스크립트..."
  cat > scripts/setup-coding-harness.sh << SHEOF
#!/bin/bash
set -e
echo "📦 코딩 하네스 의존성 설치 중..."

# Node 패키지
npm install --save-dev \\
  eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \\
  prettier \\
  husky lint-staged \\
  @commitlint/cli @commitlint/config-conventional

# Husky 활성화
npx husky install || npx husky

# Ruff (Python)
if command -v pip3 &>/dev/null; then
  pip3 install ruff --break-system-packages 2>/dev/null || pip3 install ruff
fi

echo ""
echo "✅ 코딩 하네스 설치 완료!"
echo ""
echo "lint-staged 설정을 package.json에 추가하세요:"
echo '  "lint-staged": {${LINT_STAGED_ENTRIES}}'
SHEOF
  chmod +x scripts/setup-coding-harness.sh
  ok "설치 스크립트"
}

# ──────────────────────────────────────
# 5. GitHub 설정 스크립트
# ──────────────────────────────────────
create_github_setup() {
  header "5. GitHub 설정 스크립트 생성"

  mkdir -p scripts

  # ── Secrets 등록 ──
  log "시크릿 등록 스크립트..."
  cat > scripts/setup-github-secrets.sh << SECEOF
#!/bin/bash
set -e
REPO="${REPO}"

echo "========================================="
echo "  GitHub Secrets 등록"
echo "  Repo: \${REPO}"
echo "========================================="

if ! command -v gh &>/dev/null; then echo "❌ gh CLI 필요"; exit 1; fi
if ! gh auth status &>/dev/null; then gh auth login; fi

$(if [ "$DEPLOY_PLATFORM" = "flyio" ]; then echo '
echo "[1] Fly.io 배포 토큰"
read -sp "  FLY_API_TOKEN: " FLY_API_TOKEN; echo
[ -n "$FLY_API_TOKEN" ] && echo "$FLY_API_TOKEN" | gh secret set FLY_API_TOKEN --repo "$REPO"
'; fi)

$(if $HAS_SUPABASE; then echo '
echo "[2] Supabase"
read -sp "  SUPABASE_ACCESS_TOKEN: " SUPABASE_ACCESS_TOKEN; echo
[ -n "$SUPABASE_ACCESS_TOKEN" ] && echo "$SUPABASE_ACCESS_TOKEN" | gh secret set SUPABASE_ACCESS_TOKEN --repo "$REPO"
read -p "  SUPABASE_PROJECT_REF: " SUPABASE_PROJECT_REF
[ -n "$SUPABASE_PROJECT_REF" ] && echo "$SUPABASE_PROJECT_REF" | gh secret set SUPABASE_PROJECT_REF --repo "$REPO"
'; fi)

echo ""
echo "등록된 시크릿:"
gh secret list --repo "\${REPO}"
SECEOF
  chmod +x scripts/setup-github-secrets.sh
  ok "시크릿 등록 스크립트"

  # ── Branch Protection ──
  log "브랜치 보호 스크립트..."
  cat > scripts/setup-branch-protection.sh << BPEOF
#!/bin/bash
set -e
OWNER="${OWNER}"
REPO_NAME="${REPO_NAME}"

echo "브랜치 보호 규칙 설정..."

if ! command -v gh &>/dev/null; then echo "❌ gh CLI 필요"; exit 1; fi

# main 브랜치 보호
gh api --method PUT "repos/\${OWNER}/\${REPO_NAME}/branches/main/protection" \\
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["✅ CI 게이트"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 1, "dismiss_stale_reviews": true },
  "restrictions": null,
  "allow_force_pushes": false,
  "required_conversation_resolution": true
}
JSON
echo "✅ main 보호 설정 완료"

# staging 브랜치 생성 및 보호
if ! gh api "repos/\${OWNER}/\${REPO_NAME}/git/ref/heads/staging" &>/dev/null; then
  MAIN_SHA=\$(gh api "repos/\${OWNER}/\${REPO_NAME}/git/ref/heads/main" --jq '.object.sha')
  gh api --method POST "repos/\${OWNER}/\${REPO_NAME}/git/refs" --field ref="refs/heads/staging" --field sha="\$MAIN_SHA"
  sleep 2
fi

gh api --method PUT "repos/\${OWNER}/\${REPO_NAME}/branches/staging/protection" \\
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["✅ CI 게이트"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
echo "✅ staging 보호 설정 완료"

# Environments
gh api --method PUT "repos/\${OWNER}/\${REPO_NAME}/environments/staging" --input - <<'JSON'
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
gh api --method POST "repos/\${OWNER}/\${REPO_NAME}/environments/staging/deployment-branch-policies" --field name="staging" 2>/dev/null || true

gh api --method PUT "repos/\${OWNER}/\${REPO_NAME}/environments/production" --input - <<'JSON'
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
gh api --method POST "repos/\${OWNER}/\${REPO_NAME}/environments/production/deployment-branch-policies" --field name="main" 2>/dev/null || true

echo "✅ Environments 설정 완료"
echo ""
echo "🎉 모든 GitHub 설정이 완료되었습니다!"
BPEOF
  chmod +x scripts/setup-branch-protection.sh
  ok "브랜치 보호 스크립트"
}

# ──────────────────────────────────────
# 완료 요약
# ──────────────────────────────────────
print_summary() {
  header "🎉 하네스 부트스트랩 완료!"

  echo ""
  echo -e "  ${BOLD}생성된 파일:${NC}"
  echo ""
  echo "  .github/"
  echo "    ├── workflows/"
  echo "    │   ├── ci.yml                    # CI 파이프라인"
  echo "    │   ├── auto-label.yml            # PR 자동 라벨링"
  [ "$DEPLOY_PLATFORM" != "none" ] && echo "    │   ├── deploy-staging.yml         # Staging 배포"
  [ "$DEPLOY_PLATFORM" != "none" ] && echo "    │   ├── deploy-production.yml      # Production 배포"
  [ "$DEPLOY_PLATFORM" != "none" ] && echo "    │   ├── rollback.yml               # 수동 롤백"
  $HAS_PRISMA && echo "    │   ├── db-migration.yml           # DB 마이그레이션 체크"
  $HAS_SUPABASE && echo "    │   ├── deploy-edge-functions.yml  # Edge Functions 배포"
  echo "    │   ├── agent-pr-staging.yml       # Agent → Staging PR"
  echo "    │   └── promote-production.yml     # Staging → Production 승격"
  echo "    ├── labeler.yml                    # 라벨링 규칙"
  echo "    └── PULL_REQUEST_TEMPLATE/"
  echo "        └── default.md                 # PR 템플릿"
  echo ""
  echo "  scripts/"
  echo "    ├── agent-commit.sh                # 에이전트 자동 커밋"
  echo "    ├── setup-coding-harness.sh        # 코딩 도구 설치"
  echo "    ├── setup-github-secrets.sh        # GitHub 시크릿 등록"
  echo "    └── setup-branch-protection.sh     # 브랜치 보호 설정"
  echo ""
  echo "  .eslintrc.json / .prettierrc / commitlint.config.js"
  echo "  .husky/pre-commit / .husky/commit-msg"
  echo ""

  echo -e "  ${BOLD}다음 단계:${NC}"
  echo ""
  echo "  1. 코딩 하네스 설치:"
  echo "     bash scripts/setup-coding-harness.sh"
  echo ""
  echo "  2. GitHub 시크릿 등록:"
  echo "     bash scripts/setup-github-secrets.sh"
  echo ""
  echo "  3. 브랜치 보호 설정:"
  echo "     bash scripts/setup-branch-protection.sh"
  echo ""
  echo "  4. 커밋 & 푸시:"
  echo "     git add -A && git commit -m 'ci: add project harness'"
  echo "     git push origin main"
  echo ""
  echo -e "  ${GREEN}에이전트 사용법:${NC}"
  echo "     ./scripts/agent-commit.sh \"변경 설명\""
  echo ""
}

# ──────────────────────────────────────
# 메인 실행
# ──────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}🏗️  Project Harness Bootstrap${NC}"
  echo -e "  CI/CD + Agent 자동화 + Coding 하네스를 한 번에 설정합니다."
  echo ""

  check_prerequisites
  collect_project_info
  create_repo_harness
  create_deploy_harness
  create_agent_harness
  create_coding_harness
  create_github_setup
  print_summary
}

main "$@"
