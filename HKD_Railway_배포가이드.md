# 한경배달(HKD) Backend — 배포 완료 정보

> 배포 완료일: 2026년 3월 30일
> 플랫폼: Fly.io (도쿄 리전)

---

## 1. 전제 조건

- GitHub 계정 (무료)
- Railway 계정 (GitHub으로 로그인, $5 무료 크레딧)
- Supabase DB 연결 완료 (이미 설정됨)

## 2. GitHub 저장소 생성 및 코드 푸시

### 2-1. GitHub에서 새 저장소 만들기

1. https://github.com/new 접속
2. Repository name: `hangkyeong-delivery-backend`
3. **Private** 선택 → **Create repository**

### 2-2. 로컬에서 푸시

프로젝트 폴더(`architecture/backend`)에서 실행:

```bash
cd architecture/backend
git init
git add -A
git commit -m "initial: HKD backend for Railway deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hangkyeong-delivery-backend.git
git push -u origin main
```

---

## 3. Railway 배포

### 3-1. 프로젝트 생성

1. https://railway.com 접속 → **GitHub으로 로그인**
2. **New Project** → **Deploy from GitHub repo** 클릭
3. `hangkyeong-delivery-backend` 저장소 선택
4. Railway가 `Dockerfile`을 자동 감지하여 빌드 시작

### 3-2. 환경 변수 설정

Railway 대시보드 → 프로젝트 선택 → **Variables** 탭에서 아래 환경 변수를 모두 입력합니다.

#### 필수 환경 변수

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DATABASE` | Supabase DB (Supabase 대시보드에서 확인) |
| `JWT_SECRET` | `openssl rand -hex 32` 로 생성 | JWT 시크릿 (64자) |
| `JWT_REFRESH_SECRET` | (별도 생성: `openssl rand -hex 32`) | 리프레시 토큰 시크릿 |
| `ADMIN_API_KEY` | (별도 생성: `openssl rand -hex 16`) | 관리자 API 키 |
| `NODE_ENV` | `production` | 프로덕션 모드 |
| `FRONTEND_URL` | `https://your-frontend.com` | CORS 허용 도메인 |

#### 선택 환경 변수 (미설정 시 로그 모드 동작)

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `KAKAO_REST_API_KEY` | (발급 후 입력) | 카카오 지도 API |
| `ALIGO_API_KEY` | (발급 후 입력) | SMS 발송 |
| `ALIGO_USER_ID` | (발급 후 입력) | SMS 계정 |
| `ALIGO_SENDER` | (발급 후 입력) | SMS 발신번호 |
| `PORTONE_API_KEY` | (발급 후 입력) | 결제 API |
| `PORTONE_API_SECRET` | (발급 후 입력) | 결제 시크릿 |
| `PORTONE_MERCHANT_ID` | (발급 후 입력) | 가맹점 ID |
| `FCM_SERVER_KEY` | (발급 후 입력) | 푸시 알림 |
| `REDIS_URL` | (선택) | Redis (미설정 시 인메모리) |

### 3-3. 도메인 발급

1. Railway 대시보드 → **Settings** 탭 → **Networking** → **Public Networking**
2. **Generate Domain** 클릭 → `*.up.railway.app` 도메인 자동 발급
3. 발급된 URL로 헬스체크 확인:

```bash
curl https://YOUR-APP.up.railway.app/health
```

응답 예시: `{"status":"ok","timestamp":"...","uptime":...}`

---

## 4. 카카오 Map API 연결

배포 후 Railway 도메인이 생기면, 카카오 API를 연결할 수 있습니다.

### 4-1. 카카오 앱 등록

1. https://developers.kakao.com 접속 → 로그인
2. **내 애플리케이션** → **앱 추가**
3. 앱 이름: `한경배달`
4. 앱 설정 → **플랫폼** → **Web** → 사이트 도메인 등록:
   ```
   https://YOUR-APP.up.railway.app
   ```
5. **앱 키** → **REST API 키** 복사

### 4-2. Railway에 키 등록

Railway 대시보드 → **Variables**에 추가:

```
KAKAO_REST_API_KEY=복사한_REST_API_키
```

Railway가 자동으로 재배포됩니다.

---

## 5. 배포 검증

### API 엔드포인트 테스트

```bash
# 헬스체크
curl https://YOUR-APP.up.railway.app/health

# 메뉴 검색 (카카오 API 연결 후)
curl https://YOUR-APP.up.railway.app/api/v1/restaurants/search?query=카페

# 관리자 대시보드
curl -H "x-admin-key: YOUR_ADMIN_KEY" \
  https://YOUR-APP.up.railway.app/api/v1/admin/dashboard
```

### 문제 해결

| 증상 | 확인 사항 |
|------|----------|
| 빌드 실패 | Railway 대시보드 → Deployments → 빌드 로그 확인 |
| 헬스체크 실패 | Settings → Networking에서 Public Domain 활성화 확인 |
| DB 연결 실패 | DATABASE_URL 환경변수 확인 (비밀번호 오타 주의) |
| 카카오 API 오류 | 앱 설정의 사이트 도메인이 Railway URL과 일치하는지 확인 |

---

## 6. Supabase 연결 정보

이미 설정된 Supabase 프로젝트 정보:

| 항목 | 값 |
|------|-----|
| 프로젝트명 | hangkyeong-delivery |
| 리전 | ap-northeast-2 (서울) |
| DB 호스트 | Supabase 대시보드에서 확인 |
| DB 유저 | Supabase 대시보드에서 확인 |
| DB 비밀번호 | Supabase 대시보드에서 확인 |
| DB명 | postgres |
| 테이블 수 | 12개 |
| 인덱스 수 | 47개 |
| 대시보드 | Supabase 대시보드에서 확인 |

**전체 연결 문자열** (Railway Variables에 붙여넣기):

```
postgresql://USER:PASSWORD@HOST:5432/DATABASE
# Supabase 대시보드 → Settings → Database → Connection string 에서 복사
```

---

## 7. 커스텀 도메인 연결 (선택)

자체 도메인이 있다면 Railway에 연결할 수 있습니다:

1. Railway 대시보드 → Settings → Networking
2. Custom Domain → 도메인 입력 (ex: `api.yoursite.com`)
3. Railway가 안내하는 CNAME 레코드를 DNS에 추가
4. SSL 인증서 자동 발급 (수 분 소요)

> 커스텀 도메인 연결 시 카카오 앱 설정의 도메인도 함께 변경해주세요.

---

## 8. 비용 요약

| 서비스 | 요금제 | 예상 비용 |
|--------|--------|----------|
| Railway | 초당 과금 | $2~5/월 (소규모) |
| Supabase | 무료 플랜 | $0/월 (500MB DB) |
| 카카오 Map | 무료 (일 30만건) | $0/월 |
| **합계** | | **월 $2~5 예상** |

---

## 9. 자동 배포

GitHub에 코드를 푸시하면 Railway가 자동으로 재배포합니다:

```bash
git add -A
git commit -m "feat: 새 기능 추가"
git push origin main
# → Railway 자동 빌드 + 배포 (약 2~3분)
```
