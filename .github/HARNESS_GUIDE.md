# HKD CI/CD 하네스 가이드

## 개요

이 프로젝트는 GitHub Actions 기반의 자동화된 CI/CD 파이프라인을 갖추고 있습니다.

```
[수동 개발]
개발자 → PR 생성 → CI 자동 실행 → 리뷰/머지
                                      ↓
         staging 브랜치 ← ─── staging 배포 (자동)
                                      ↓
         main 브랜치 ← ──── production 배포 (자동)
                                      ↓
                              헬스체크 → 실패 시 자동 롤백

[에이전트 자동화]
에이전트 세션 → agent/* 브랜치에 auto-commit
                  ↓
      자동 PR 생성 (→ staging) + CI 검증
                  ↓
      CI 통과 → staging 머지 → staging 배포
                  ↓
      검증 완료 → Promote to Production → main 머지 → production 배포
```

---

## 1. 레포지터리 하네스

### 워크플로우 구성

| 파일 | 트리거 | 역할 |
|------|--------|------|
| `ci.yml` | PR, push (main/staging) | 린트, 타입체크, 테스트, 빌드, Docker 검증 |
| `auto-label.yml` | PR 생성/업데이트 | 변경 파일 기반 자동 라벨 부여 |
| `db-migration.yml` | PR (prisma 변경) | Prisma 스키마 검증 및 마이그레이션 체크 |

### CI 파이프라인 상세

CI는 **변경 감지** 후 해당 부분만 실행합니다:

- **백엔드** (`architecture/backend/`): npm ci → prisma generate → tsc --noEmit → build → jest
- **프론트엔드** (`architecture/frontend/`): npm ci → prisma generate → lint → tsc --noEmit → next build
- **스크래퍼** (`scrapers/`, `tests/`): pip install → pytest (단위 테스트만)
- **Docker 검증**: 백엔드/프론트엔드 Dockerfile 빌드 테스트

모든 체크가 통과해야 PR 머지가 가능합니다 (`ci-gate` job).

### 자동 라벨링 규칙

PR 변경 파일에 따라 자동 라벨:
- `backend` / `frontend` / `scrapers`
- `infra` (Dockerfile, fly.toml, .github)
- `docs` (*.md 파일)
- `database` (prisma, *.sql)
- `scripts` (셸 스크립트)

---

## 2. 배포 하네스

### 배포 흐름

```
staging 브랜치 push → deploy-staging.yml → Fly.io staging 앱 배포 → 헬스체크
main 브랜치 push    → deploy-production.yml → Fly.io production 앱 배포 → 헬스체크 → (실패 시 자동 롤백)
```

### Production 배포 특징

1. **순차 배포**: 백엔드 먼저, 프론트엔드 나중에 (API 호환성 보장)
2. **자동 롤백**: 헬스체크 5회 실패 시 이전 이미지로 자동 복구
3. **이전 버전 기록**: 배포 전 현재 버전을 저장해 롤백에 활용
4. **환경 보호**: `environment: production` 으로 수동 승인 설정 가능

### 수동 롤백

GitHub Actions → "Manual Rollback" → Run workflow:
- 대상 서비스: backend / frontend / both
- 릴리즈 번호 (선택)
- 롤백 사유 (필수)

### Supabase Edge Functions

`supabase/functions/` 디렉토리에 함수를 추가하고 main에 push하면 자동 배포됩니다.
수동 실행 시 특정 함수명을 지정할 수 있습니다.

---

## 3. 필요한 GitHub Secrets

### 필수

| Secret | 설명 | 획득 방법 |
|--------|------|-----------|
| `FLY_API_TOKEN` | Fly.io 배포 토큰 | `flyctl tokens create deploy` |

### 선택 (기능별)

| Secret | 설명 |
|--------|------|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI 토큰 (Edge Functions 배포용) |
| `SUPABASE_PROJECT_REF` | Supabase 프로젝트 참조 ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 |

### 백엔드 테스트용 (CI에서 자동 설정)

CI 워크플로우에서 테스트용 기본값을 사용하므로 별도 설정 불필요합니다.

---

## 4. GitHub 환경(Environment) 설정

### Staging 환경

1. GitHub → Settings → Environments → "staging" 생성
2. Staging 전용 시크릿 설정 (필요 시)

### Production 환경

1. GitHub → Settings → Environments → "production" 생성
2. (선택) "Required reviewers" 활성화 → 수동 승인 후 배포
3. (선택) "Wait timer" 설정 → 배포 전 지연 시간

---

## 5. 브랜치 보호 규칙

GitHub → Settings → Branches에서 다음을 설정하세요:

### `main` 브랜치

- ✅ Require a pull request before merging
- ✅ Require status checks to pass → "CI 게이트" 선택
- ✅ Require branches to be up to date
- ✅ Do not allow bypassing the above settings

### `staging` 브랜치

- ✅ Require status checks to pass → "CI 게이트" 선택

---

## 6. 개발 워크플로우

### 수동 개발

```bash
# 1. 기능 브랜치 생성
git checkout -b feature/my-feature

# 2. 개발 및 커밋
git add . && git commit -m "feat: 새 기능 추가"

# 3. PR 생성 → CI 자동 실행
git push origin feature/my-feature
gh pr create --base staging

# 4. CI 통과 + 리뷰 → staging 머지
# → staging 자동 배포 → staging 환경에서 테스트

# 5. staging → main PR 생성 및 머지
# → production 자동 배포 → 헬스체크 → 완료
```

### 에이전트 자동화 워크플로우

에이전트 세션에서 코드를 변경하면 `agent-commit.sh` 스크립트를 통해 자동으로 안전하게 커밋됩니다.

```bash
# 1. 에이전트가 코드 변경 후 자동 커밋
./scripts/agent-commit.sh "주문 API 에러 핸들링 개선"

# 스크립트가 자동으로:
# - main/staging에 있으면 agent/* 브랜치 생성
# - .env, credentials 등 위험 파일 자동 제외
# - Conventional Commits 형식 메시지 생성
# - 원격에 push

# 2. 자동 PR 생성 (agent-pr-staging.yml)
# agent/* 브랜치에 push → staging 대상 PR 자동 생성
# 같은 브랜치에 추가 커밋 → 기존 PR에 코멘트 추가

# 3. CI 자동 검증
# PR에 대해 ci.yml이 자동 실행
# 린트, 타입체크, 빌드, Docker 검증

# 4. staging 머지 후 검증
# staging 환경에서 실제 동작 확인

# 5. Production 승격
# Actions → "Promote to Production" → 배포 설명 입력 → 실행
# staging → main PR 자동 생성
```

### 안전장치

| 계층 | 보호 내용 |
|------|-----------|
| `agent-commit.sh` | main/staging 직접 커밋 차단, 위험 파일(.env 등) 자동 제외 |
| `agent-pr-staging.yml` | feature→staging PR 자동 생성, CI 검증 강제 |
| `ci.yml` | 린트/타입체크/빌드/Docker 검증 |
| `deploy-staging.yml` | staging 배포 + 헬스체크 |
| `promote-production.yml` | 수동 승격만 허용, 변경 내역 자동 문서화 |
| `deploy-production.yml` | 순차 배포 + 헬스체크 + 자동 롤백 |

---

## 7. 문제 해결

| 상황 | 해결 방법 |
|------|-----------|
| CI가 실행되지 않음 | `.github/workflows/` 파일이 default 브랜치에 있는지 확인 |
| Docker 빌드 실패 | 로컬에서 `docker build` 테스트 |
| 배포 후 헬스체크 실패 | Fly.io 로그 확인: `flyctl logs --app hkd-backend` |
| 롤백이 필요 | Actions → Manual Rollback → Run workflow |
| Edge Function 배포 실패 | `SUPABASE_ACCESS_TOKEN` 시크릿 확인 |
