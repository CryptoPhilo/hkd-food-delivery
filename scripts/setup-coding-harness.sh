#!/bin/bash
# ============================================
# HKD 코딩 하네스 로컬 설치 스크립트
# 사용법: bash scripts/setup-coding-harness.sh
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  HKD 코딩 하네스 설치${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ──────────────────────────────────────────
# 1. Node.js 확인
# ──────────────────────────────────────────
echo -e "${YELLOW}[1/4] Node.js 확인...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js가 설치되어 있지 않습니다.${NC}"
  echo "   brew install node  또는  https://nodejs.org"
  exit 1
fi
NODE_VER=$(node --version)
echo -e "  ${GREEN}✅ Node.js ${NODE_VER}${NC}"
echo ""

# ──────────────────────────────────────────
# 2. npm 의존성 설치 (루트 - 린터/포매터/훅)
# ──────────────────────────────────────────
echo -e "${YELLOW}[2/4] 루트 의존성 설치 (ESLint, Prettier, Husky, commitlint)...${NC}"
npm install
echo -e "  ${GREEN}✅ 루트 의존성 설치 완료${NC}"
echo ""

# ──────────────────────────────────────────
# 3. Husky Git 훅 활성화
# ──────────────────────────────────────────
echo -e "${YELLOW}[3/4] Husky Git 훅 활성화...${NC}"
npx husky
echo -e "  ${GREEN}✅ Git 훅 활성화 완료${NC}"
echo "    ├─ pre-commit: lint-staged (ESLint + Prettier + Ruff)"
echo "    └─ commit-msg: commitlint (Conventional Commits)"
echo ""

# ──────────────────────────────────────────
# 4. Python Ruff 설치 (선택)
# ──────────────────────────────────────────
echo -e "${YELLOW}[4/4] Python Ruff 린터 설치...${NC}"
if command -v pip3 &> /dev/null; then
  pip3 install ruff --quiet 2>/dev/null || pip3 install ruff --break-system-packages --quiet 2>/dev/null
  RUFF_VER=$(ruff --version 2>/dev/null || echo "설치 실패")
  echo -e "  ${GREEN}✅ Ruff ${RUFF_VER}${NC}"
elif command -v pip &> /dev/null; then
  pip install ruff --quiet 2>/dev/null || pip install ruff --break-system-packages --quiet 2>/dev/null
  RUFF_VER=$(ruff --version 2>/dev/null || echo "설치 실패")
  echo -e "  ${GREEN}✅ Ruff ${RUFF_VER}${NC}"
else
  echo -e "  ${YELLOW}⚠️  pip이 없어 Ruff를 설치하지 못했습니다.${NC}"
  echo "     brew install ruff  또는  pip install ruff"
fi
echo ""

# ──────────────────────────────────────────
# 테스트
# ──────────────────────────────────────────
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  설치 검증${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -n "  ESLint:     "
npx eslint --version 2>/dev/null && echo "" || echo -e "${RED}❌${NC}"

echo -n "  Prettier:   "
npx prettier --version 2>/dev/null && echo "" || echo -e "${RED}❌${NC}"

echo -n "  commitlint: "
npx commitlint --version 2>/dev/null && echo "" || echo -e "${RED}❌${NC}"

echo -n "  Ruff:       "
ruff --version 2>/dev/null || echo -e "${YELLOW}미설치 (Python 린팅 불가)${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  🎉 코딩 하네스 설치 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  이제 커밋할 때 자동으로:"
echo "    1. TS/TSX → ESLint + Prettier 자동 수정"
echo "    2. Python → Ruff 자동 수정"
echo "    3. 커밋 메시지 → Conventional Commits 규칙 검증"
echo ""
echo "  커밋 메시지 예시:"
echo "    feat(backend): 주문 API 추가"
echo "    fix(frontend): 로그인 버그 수정"
echo "    docs: README 업데이트"
echo "    chore(deps): 의존성 업데이트"
echo ""
echo "  수동 실행:"
echo "    npm run lint          # TS/TSX 린트"
echo "    npm run format        # TS/TSX 포맷"
echo "    npm run lint:python   # Python 린트"
echo "    npm run format:python # Python 포맷"
