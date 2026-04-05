#!/bin/bash
# ============================================
# HKD GitHub Secrets 등록 스크립트
# 사용법: bash scripts/setup-github-secrets.sh
# 사전조건: gh auth login 완료 필요
# ============================================

set -e

REPO="CryptoPhilo/hkd-food-delivery"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  HKD GitHub Secrets 등록${NC}"
echo -e "${CYAN}  Repo: ${REPO}${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# gh CLI 확인
if ! command -v gh &> /dev/null; then
  echo -e "${RED}❌ gh CLI가 설치되어 있지 않습니다.${NC}"
  echo "   brew install gh  (macOS)"
  echo "   https://cli.github.com 에서 설치해주세요."
  exit 1
fi

# 인증 확인
if ! gh auth status &> /dev/null; then
  echo -e "${YELLOW}⚠️  GitHub 인증이 필요합니다.${NC}"
  gh auth login
fi

echo -e "${GREEN}✅ GitHub CLI 인증 확인 완료${NC}"
echo ""

# ──────────────────────────────────────────
# 1. 필수 시크릿: Fly.io
# ──────────────────────────────────────────
echo -e "${YELLOW}[1/4] Fly.io 배포 토큰${NC}"
echo "  생성 방법: flyctl tokens create deploy"
echo ""
read -sp "  FLY_API_TOKEN: " FLY_API_TOKEN
echo ""
if [ -n "$FLY_API_TOKEN" ]; then
  echo "$FLY_API_TOKEN" | gh secret set FLY_API_TOKEN --repo "$REPO"
  echo -e "  ${GREEN}✅ FLY_API_TOKEN 등록 완료${NC}"
else
  echo -e "  ${YELLOW}⏭️  건너뜀${NC}"
fi
echo ""

# ──────────────────────────────────────────
# 2. Supabase 시크릿
# ──────────────────────────────────────────
echo -e "${YELLOW}[2/4] Supabase 설정${NC}"
echo "  - Access Token: https://supabase.com/dashboard/account/tokens"
echo "  - Project Ref: Supabase 대시보드 → Settings → General"
echo ""

read -sp "  SUPABASE_ACCESS_TOKEN: " SUPABASE_ACCESS_TOKEN
echo ""
if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "$SUPABASE_ACCESS_TOKEN" | gh secret set SUPABASE_ACCESS_TOKEN --repo "$REPO"
  echo -e "  ${GREEN}✅ SUPABASE_ACCESS_TOKEN 등록 완료${NC}"
else
  echo -e "  ${YELLOW}⏭️  건너뜀${NC}"
fi

read -p "  SUPABASE_PROJECT_REF: " SUPABASE_PROJECT_REF
if [ -n "$SUPABASE_PROJECT_REF" ]; then
  echo "$SUPABASE_PROJECT_REF" | gh secret set SUPABASE_PROJECT_REF --repo "$REPO"
  echo -e "  ${GREEN}✅ SUPABASE_PROJECT_REF 등록 완료${NC}"
else
  echo -e "  ${YELLOW}⏭️  건너뜀${NC}"
fi

read -p "  NEXT_PUBLIC_SUPABASE_URL: " NEXT_PUBLIC_SUPABASE_URL
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "$NEXT_PUBLIC_SUPABASE_URL" | gh secret set NEXT_PUBLIC_SUPABASE_URL --repo "$REPO"
  echo -e "  ${GREEN}✅ NEXT_PUBLIC_SUPABASE_URL 등록 완료${NC}"
else
  echo -e "  ${YELLOW}⏭️  건너뜀${NC}"
fi

read -p "  NEXT_PUBLIC_SUPABASE_ANON_KEY: " NEXT_PUBLIC_SUPABASE_ANON_KEY
if [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --repo "$REPO"
  echo -e "  ${GREEN}✅ NEXT_PUBLIC_SUPABASE_ANON_KEY 등록 완료${NC}"
else
  echo -e "  ${YELLOW}⏭️  건너뜀${NC}"
fi
echo ""

# ──────────────────────────────────────────
# 3. 백엔드 환경변수 (Production)
# ──────────────────────────────────────────
echo -e "${YELLOW}[3/4] 백엔드 환경변수 (선택사항 - Fly.io secrets로도 관리 가능)${NC}"
echo ""

read -sp "  DATABASE_URL: " DATABASE_URL
echo ""
if [ -n "$DATABASE_URL" ]; then
  echo "$DATABASE_URL" | gh secret set DATABASE_URL --repo "$REPO"
  echo -e "  ${GREEN}✅ DATABASE_URL 등록 완료${NC}"
else
  echo -e "  ${YELLOW}⏭️  건너뜀${NC}"
fi

read -sp "  JWT_SECRET (openssl rand -hex 32로 생성): " JWT_SECRET
echo ""
if [ -n "$JWT_SECRET" ]; then
  echo "$JWT_SECRET" | gh secret set JWT_SECRET --repo "$REPO"
  echo -e "  ${GREEN}✅ JWT_SECRET 등록 완료${NC}"
else
  echo -e "  ${YELLOW}⏭️  건너뜀${NC}"
fi

read -sp "  JWT_REFRESH_SECRET: " JWT_REFRESH_SECRET
echo ""
if [ -n "$JWT_REFRESH_SECRET" ]; then
  echo "$JWT_REFRESH_SECRET" | gh secret set JWT_REFRESH_SECRET --repo "$REPO"
  echo -e "  ${GREEN}✅ JWT_REFRESH_SECRET 등록 완료${NC}"
else
  echo -e "  ${YELLOW}⏭️  건너뜀${NC}"
fi

read -sp "  ADMIN_API_KEY: " ADMIN_API_KEY
echo ""
if [ -n "$ADMIN_API_KEY" ]; then
  echo "$ADMIN_API_KEY" | gh secret set ADMIN_API_KEY --repo "$REPO"
  echo -e "  ${GREEN}✅ ADMIN_API_KEY 등록 완료${NC}"
else
  echo -e "  ${YELLOW}⏭️  건너뜀${NC}"
fi
echo ""

# ──────────────────────────────────────────
# 4. 알림 (선택)
# ──────────────────────────────────────────
echo -e "${YELLOW}[4/4] 알림 설정 (선택)${NC}"
echo ""

read -p "  SLACK_WEBHOOK_URL (없으면 Enter): " SLACK_WEBHOOK_URL
if [ -n "$SLACK_WEBHOOK_URL" ]; then
  echo "$SLACK_WEBHOOK_URL" | gh secret set SLACK_WEBHOOK_URL --repo "$REPO"
  echo -e "  ${GREEN}✅ SLACK_WEBHOOK_URL 등록 완료${NC}"
else
  echo -e "  ${YELLOW}⏭️  건너뜀${NC}"
fi
echo ""

# ──────────────────────────────────────────
# 결과 확인
# ──────────────────────────────────────────
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  등록된 시크릿 목록${NC}"
echo -e "${CYAN}========================================${NC}"
gh secret list --repo "$REPO"
echo ""
echo -e "${GREEN}✅ 시크릿 등록 완료!${NC}"
echo -e "   다음 단계: ${CYAN}bash scripts/setup-branch-protection.sh${NC}"
