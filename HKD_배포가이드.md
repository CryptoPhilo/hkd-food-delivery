# 한경배달(HKD) Backend — 배포 가이드

> 최종 업데이트: 2026년 4월 4일
> 플랫폼: Fly.io (도쿄 리전)
> CI/CD: GitHub Actions

---

## 1. 전제 조건

- GitHub 계정
- Fly.io 계정 (`flyctl` CLI 설치)
- Supabase 프로젝트 (DB)
- Node.js 18+ (로컬 개발용)

## 2. 환경변수 설정

### 2-1. 로컬 개발 환경

```bash
cp .env.example .env
# .env 파일을 편집하여 실제 값을 입력
```

### 2-2. GitHub Secrets 등록

GitHub 저장소 → Settings → Secrets and variables → Actions에서 다음 시크릿을 등록합니다.

#### 필수 시크릿

| 시크릿명 | 설명 | 생성 방법 |
|---------|------|----------|
| `DATABASE_URL` | Supabase DB 연결 문자열 | Supabase 대시보드 → Settings → Database |
| `JWT_SECRET` | JWT 시크릿 (64자) | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | 리프레시 토큰 시크릿 | `openssl rand -hex 32` |
| `ADMIN_API_KEY` | 관리자 API 키 | `openssl rand -hex 16` |
| `FLY_API_TOKEN` | Fly.io 배포 토큰 | `flyctl tokens create deploy` |

#### 선택 시크릿 (미설정 시 로그 모드 동작)

| 시크릿명 | 설명 |
|---------|------|
| `KAKAO_REST_API_KEY` | 카카오 지도 API (developers.kakao.com) |
| `ALIGO_API_KEY` / `ALIGO_USER_ID` / `ALIGO_SENDER` | SMS 발송 (알리고) |
| `PORTONE_API_KEY` / `PORTONE_API_SECRET` / `PORTONE_MERCHANT_ID` | 결제 (포트원) |
| `FCM_SERVER_KEY` | 푸시 알림 |

### 2-3. Fly.io 환경변수

```bash
flyctl secrets set DATABASE_URL="postgresql://..." JWT_SECRET="..." --app hkd-backend
```

## 3. Fly.io 배포

### 3-1. 최초 배포

```bash
# Fly.io CLI 설치 (macOS)
brew install flyctl

# 로그인
flyctl auth login

# 프로젝트 디렉토리에서 초기화
cd architecture/backend
flyctl launch --name hkd-backend --region nrt  # 도쿄 리전

# 환경변수 설정
flyctl secrets set \
  DATABASE_URL="<Supabase에서 복사>" \
  JWT_SECRET="<생성한 시크릿>" \
  ADMIN_API_KEY="<생성한 키>" \
  NODE_ENV=production

# 배포
flyctl deploy
```

### 3-2. 자동 배포 (CI/CD)

GitHub Actions가 설정되어 있으므로 `main` 브랜치에 푸시하면 자동 배포됩니다.

```bash
git push origin main
# → GitHub Actions → 빌드/테스트 → Fly.io 배포 (약 3-5분)
```

### 3-3. 수동 배포

```bash
flyctl deploy --app hkd-backend
```

## 4. 배포 검증

```bash
# 헬스체크
curl https://hkd-backend.fly.dev/health

# 식당 목록 (인증 필요 없음)
curl https://hkd-backend.fly.dev/api/v1/restaurants

# 관리자 대시보드 (Admin API Key 필요)
curl -H "X-Admin-Key: <YOUR_ADMIN_KEY>" \
  https://hkd-backend.fly.dev/api/v1/admin/dashboard
```

## 5. 운영 관리

### 5-1. 로그 확인

```bash
flyctl logs --app hkd-backend
flyctl logs --app hkd-backend -i <instance-id>  # 특정 인스턴스
```

### 5-2. 모니터링

```bash
flyctl status --app hkd-backend
flyctl dashboard --app hkd-backend  # 웹 대시보드 열기
```

### 5-3. 스케일링

```bash
flyctl scale count 2 --app hkd-backend    # 인스턴스 2개로
flyctl scale memory 512 --app hkd-backend  # 메모리 512MB로
```

### 5-4. 롤백

```bash
# 이전 배포 목록 확인
flyctl releases --app hkd-backend

# 특정 버전으로 롤백
flyctl deploy --image <previous-image> --app hkd-backend
```

## 6. 문제 해결

| 증상 | 확인 사항 |
|------|----------|
| 빌드 실패 | `flyctl logs` → 빌드 에러 확인, Dockerfile 검증 |
| 헬스체크 실패 | `flyctl status` → 인스턴스 상태 확인 |
| DB 연결 실패 | `flyctl secrets list` → DATABASE_URL 확인 |
| 카카오 API 오류 | developers.kakao.com → 앱 설정 → 도메인 확인 |
| 메모리 부족 | `flyctl scale memory 512` → 메모리 증설 |

## 7. 비용 요약

| 서비스 | 요금제 | 예상 비용 |
|--------|--------|----------|
| Fly.io | 종량제 (무료 크레딧 포함) | $2~5/월 |
| Supabase | 무료 플랜 | $0/월 (500MB DB) |
| 카카오 Map | 무료 (일 30만건) | $0/월 |
| **합계** | | **월 $2~5** |

---

> **주의:** 이 문서에는 실제 API 키나 비밀번호가 포함되어 있지 않습니다.
> 모든 시크릿은 `.env` 파일 또는 GitHub Secrets를 통해 관리하세요.
