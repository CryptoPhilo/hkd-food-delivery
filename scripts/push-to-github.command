#!/bin/bash

cd "$(dirname "$0")"

echo "========================================="
echo "GitHub 푸시 스크립트"
echo "========================================="

# Check if gh is installed
if command -v gh &> /dev/null; then
    echo "GitHub CLI 발견, 인증 시도..."
    gh auth login
    git push origin main --tags
else
    echo "GitHub CLI가 설치되어 있지 않습니다."
    echo ""
    echo "다음 방법 중 하나를 선택하세요:"
    echo ""
    echo "방법 1: VS Code에서 푸시"
    echo "  - VS Code에서 이 폴더를 열고"
    echo "  - Source Control 아이콘 클릭"
    echo "  - 'Sync Changes' 버튼 클릭"
    echo ""
    echo "방법 2: GitHub Desktop 사용"
    echo "  - https://desktop.github.com 에서 설치"
    echo "  - 이 폴더를 GitHub Desktop에서 열기"
    echo "  - 'Push origin' 클릭"
    echo ""
    echo "방법 3: 터미널에서手動"
    echo "  - 터미널에서 이 폴더로 이동"
    echo "  - git push 입력"
fi

echo ""
echo "현재 커밋 상태:"
git log --oneline -3

echo ""
echo "태그 목록:"
git tag -l

echo ""
echo "========================================="
echo "완료!"
echo "========================================="
