#!/bin/bash
# ============================================
# HKD 프론트엔드 + 백엔드 동시 배포 스크립트
# 프론트엔드 먼저 → 백엔드 순서 (안전한 배포)
# ============================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  HKD 배포 시작${NC}"
echo -e "${YELLOW}========================================${NC}"

# 1. 프론트엔드 배포
echo -e "\n${GREEN}[1/2] 프론트엔드 배포 중...${NC}"
cd "$SCRIPT_DIR/frontend"
flyctl deploy --app hkd-frontend

echo -e "${GREEN}[1/2] 프론트엔드 배포 완료 ✓${NC}"

# 2. 백엔드 배포
echo -e "\n${GREEN}[2/2] 백엔드 배포 중...${NC}"
cd "$SCRIPT_DIR/backend"
flyctl deploy --app hkd-backend

echo -e "${GREEN}[2/2] 백엔드 배포 완료 ✓${NC}"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  배포 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  프론트: https://hankyeong.xyz"
echo -e "  백엔드: https://api.hankyeong.xyz"
