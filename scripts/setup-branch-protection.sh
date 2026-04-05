#!/bin/bash
# ============================================
# HKD 브랜치 보호 규칙 + CI 게이트 필수 설정
# 사용법: bash scripts/setup-branch-protection.sh
# 사전조건: gh auth login 완료 필요
# ============================================

set -e

REPO="CryptoPhilo/hkd-food-delivery"
OWNER="CryptoPhilo"
REPO_NAME="hkd-food-delivery"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  HKD 브랜치 보호 규칙 설정${NC}"
echo -e "${CYAN}  Repo: ${REPO}${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# gh CLI 확인
if ! command -v gh &> /dev/null; then
  echo -e "${RED}❌ gh CLI가 설치되어 있지 않습니다.${NC}"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo -e "${YELLOW}⚠️  GitHub 인증이 필요합니다.${NC}"
  gh auth login
fi

# ──────────────────────────────────────────
# 1. main 브랜치 보호 규칙
# ──────────────────────────────────────────
echo -e "${YELLOW}[1/3] main 브랜치 보호 규칙 설정...${NC}"

gh api --method PUT "repos/${OWNER}/${REPO_NAME}/branches/main/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["✅ CI 게이트"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "required_conversation_resolution": true
}
EOF

echo -e "${GREEN}✅ main 브랜치 보호 설정 완료${NC}"
echo "   - PR 필수 (1명 이상 승인)"
echo "   - CI 게이트 통과 필수"
echo "   - 브랜치 최신 상태 필수"
echo "   - 강제 푸시 금지"
echo "   - 대화 해결 필수"
echo ""

# ──────────────────────────────────────────
# 2. staging 브랜치 생성 및 보호 규칙
# ──────────────────────────────────────────
echo -e "${YELLOW}[2/3] staging 브랜치 설정...${NC}"

# staging 브랜치 확인 및 생성
echo "  staging 브랜치 확인 중..."
if ! gh api "repos/${OWNER}/${REPO_NAME}/git/ref/heads/staging" &>/dev/null; then
  echo "  staging 브랜치 생성 중..."
  MAIN_SHA=$(gh api "repos/${OWNER}/${REPO_NAME}/git/ref/heads/main" --jq '.object.sha')
  gh api --method POST "repos/${OWNER}/${REPO_NAME}/git/refs" \
    --field ref="refs/heads/staging" \
    --field sha="$MAIN_SHA" > /dev/null
  echo -e "  ${GREEN}✅ staging 브랜치 생성 완료${NC}"
  sleep 2  # 브랜치 생성 후 API 반영 대기
else
  echo -e "  ${GREEN}✅ staging 브랜치 이미 존재${NC}"
fi

gh api --method PUT "repos/${OWNER}/${REPO_NAME}/branches/staging/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["✅ CI 게이트"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

echo -e "${GREEN}✅ staging 브랜치 보호 설정 완료${NC}"
echo "   - CI 게이트 통과 필수"
echo "   - PR 없이 직접 푸시 가능"
echo ""

# ──────────────────────────────────────────
# 3. GitHub Environments 생성
# ──────────────────────────────────────────
echo -e "${YELLOW}[3/3] GitHub Environments 생성...${NC}"

# staging 환경
gh api --method PUT "repos/${OWNER}/${REPO_NAME}/environments/staging" \
  --input - <<'EOF'
{
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
EOF

# staging 환경에 브랜치 정책 추가
gh api --method POST "repos/${OWNER}/${REPO_NAME}/environments/staging/deployment-branch-policies" \
  --field name="staging" 2>/dev/null || true

echo -e "  ${GREEN}✅ staging 환경 생성 완료${NC}"

# production 환경
gh api --method PUT "repos/${OWNER}/${REPO_NAME}/environments/production" \
  --input - <<'EOF'
{
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
EOF

# production 환경에 브랜치 정책 추가
gh api --method POST "repos/${OWNER}/${REPO_NAME}/environments/production/deployment-branch-policies" \
  --field name="main" 2>/dev/null || true

echo -e "  ${GREEN}✅ production 환경 생성 완료${NC}"
echo ""

# ──────────────────────────────────────────
# 결과 요약
# ──────────────────────────────────────────
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  설정 완료 요약${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "  ${GREEN}main 브랜치${NC}"
echo "    ├─ PR 필수 (1명 승인)"
echo "    ├─ CI 게이트 (✅ CI 게이트) 필수"
echo "    ├─ 브랜치 최신 상태 필수"
echo "    └─ 강제 푸시 금지"
echo ""
echo -e "  ${GREEN}staging 브랜치${NC}"
echo "    ├─ CI 게이트 필수"
echo "    └─ 직접 푸시 가능"
echo ""
echo -e "  ${GREEN}Environments${NC}"
echo "    ├─ staging  → staging 브랜치만 배포 가능"
echo "    └─ production → main 브랜치만 배포 가능"
echo ""
echo -e "${GREEN}🎉 모든 설정이 완료되었습니다!${NC}"
echo ""
echo -e "  (선택) Production 수동 승인 추가:"
echo -e "  GitHub → Settings → Environments → production"
echo -e "  → Required reviewers 활성화"
