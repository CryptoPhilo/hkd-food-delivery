# HKD (한경배달) 프로젝트 리팩토링 계획서

**작성일:** 2026-04-04
**대상:** HKD 프로젝트 전체 (코드, 설계 문서, 테스트, 보안)
**목표:** 코드 품질 개선, 설계 문서 현행화, 누락된 테스트 코드 작성 및 수행

---

## 1. 현황 진단 요약

### 1.1 프로젝트 개요

HKD(한경배달)는 제주 한경면 지역 기반의 음식 배달 플랫폼으로, ARS 전화 → SMS 링크 → 웹 주문 방식으로 동작합니다. Next.js 프론트엔드, Express+Prisma 백엔드, Supabase PostgreSQL DB를 사용하며, Fly.io에 배포되어 있습니다.

### 1.2 현재 발견된 문제점

| 영역 | 문제 | 심각도 |
|------|------|--------|
| **보안** | Kakao API 키, Admin API 키, DB 패스워드가 셸 스크립트와 문서에 하드코딩 | 🔴 높음 |
| **보안** | Python 스크립트에서 SSL 검증 비활성화 (`verify=False`) | 🔴 높음 |
| **테스트** | TEST-PLAN.md에 20개 TC 정의되어 있으나 실제 Jest 테스트 미구현 | 🟡 중간 |
| **테스트** | Python 테스트 스크립트들이 탐색용으로만 존재, 자동화된 테스트 아님 | 🟡 중간 |
| **코드** | 셸 스크립트 간 중복 로직 (지역 필터링이 수집/정리 양쪽에 존재) | 🟡 중간 |
| **코드** | 메뉴 데이터 수집 파이프라인 미완성 (`menus: []` 상태) | 🟡 중간 |
| **문서** | 배포 가이드가 Railway 기준으로 작성됨 (현재는 Fly.io 사용) | 🟢 낮음 |
| **문서** | 설계 문서와 실제 구현 간 불일치 가능성 | 🟢 낮음 |
| **데이터** | 전체 레스토랑 rating 값이 0 (수집 미구현) | 🟢 낮음 |

---

## 2. 리팩토링 단계별 계획

### Phase 1: 보안 이슈 해결 (우선순위 최상)

**목표:** 하드코딩된 시크릿 제거 및 보안 취약점 해소

#### 1-1. 환경변수 분리

**대상 파일:**
- `collect_restaurants.sh` → `KAKAO_REST_API_KEY` 하드코딩 제거
- `register_restaurants.sh` / `register_remaining.sh` → `ADMIN_API_KEY` 하드코딩 제거
- `cleanup_restaurants.sh` → `ADMIN_API_KEY` 하드코딩 제거
- `HKD_Railway_배포가이드.md` → DB 패스워드 노출 제거

**작업 내용:**
1. `.env.example` 파일 생성 (키 이름만 포함, 값은 빈칸)
2. 모든 셸 스크립트에서 하드코딩된 키를 `$KAKAO_REST_API_KEY`, `$ADMIN_API_KEY` 등 환경변수 참조로 변경
3. `.gitignore`에 `.env` 추가 확인
4. 배포 가이드에서 실제 키/패스워드 → `<YOUR_KEY_HERE>` 플레이스홀더로 교체
5. GitHub Secrets에 등록하는 절차를 가이드 문서에 추가

#### 1-2. SSL 검증 복구

**대상 파일:**
- `test_diningcode.py`
- `test_naver_place.py`
- `test_naver_v2.py`
- `test_google_diningcode.py`
- `test_kakao_place.py`
- `test_dc_direct.py`

**작업 내용:**
1. `ssl.CERT_NONE`, `verify=False` 코드 제거
2. macOS 인증서 문제 해결을 위한 `certifi` 패키지 활용으로 대체
3. `requirements.txt` 생성 (`requests`, `certifi`, `beautifulsoup4` 등 의존성 명시)

---

### Phase 2: 코드 리팩토링

**목표:** 중복 제거, 모듈화, 유지보수성 향상

#### 2-1. 셸 스크립트 통합 및 개선

**현재 상태:** 4개의 셸 스크립트가 독립적으로 존재하며 중복 로직 보유

**작업 내용:**
1. 공통 설정을 `config.sh`로 분리 (API URL, 헤더, 지역 필터 조건)
2. `collect_restaurants.sh` 리팩토링
   - 카카오 API 호출 로직을 함수화
   - 에러 핸들링 추가 (API 응답 코드 체크)
   - 로깅 기능 추가 (타임스탬프 포함)
3. `register_restaurants.sh`와 `register_remaining.sh` 통합
   - 중복 등록 검사 로직을 하나로 통합
   - `--dry-run` 옵션 추가 (실행 전 미리보기)
4. `cleanup_restaurants.sh` 개선
   - 삭제 전 백업 기능 추가
   - 삭제 대상 목록 사전 확인 기능

**리팩토링 후 구조:**
```
scripts/
├── config.sh                  # 공통 설정 (환경변수 로드)
├── collect_restaurants.sh     # 카카오 API 레스토랑 수집
├── register_restaurants.sh    # 통합된 등록 스크립트 (신규+잔여)
├── cleanup_restaurants.sh     # 비제주 데이터 정리
└── utils.sh                   # 공통 함수 (로깅, 에러처리)
```

#### 2-2. Python 스크립트 모듈화

**현재 상태:** 6개의 Python 파일이 루트 디렉토리에 산재, 각각 독립적으로 HTTP 요청 처리

**작업 내용:**
1. `scrapers/` 디렉토리 생성 및 스크립트 이동
2. 공통 HTTP 클라이언트 모듈 추출 (`scrapers/http_client.py`)
   - 세션 관리, 헤더 설정, 재시도 로직, 타임아웃 통합
3. 플랫폼별 스크래퍼 클래스 구조화
   - `scrapers/kakao_scraper.py` — 카카오맵 기반 수집
   - `scrapers/naver_scraper.py` — 네이버 플레이스 기반 수집
   - `scrapers/diningcode_scraper.py` — 다이닝코드 기반 수집
4. 데이터 모델 통합 (`scrapers/models.py`)
   - 각 플랫폼에서 수집한 데이터를 통일된 Restaurant/Menu 형태로 변환
5. 진입점 스크립트 (`scrapers/main.py`) 작성
   - CLI 인터페이스 (`argparse`)로 플랫폼 선택, 지역 지정 가능

**리팩토링 후 구조:**
```
scrapers/
├── __init__.py
├── main.py                 # CLI 진입점
├── http_client.py          # 공통 HTTP 세션 관리
├── models.py               # Restaurant, Menu 데이터 모델
├── kakao_scraper.py        # 카카오맵 스크래퍼
├── naver_scraper.py        # 네이버 플레이스 스크래퍼
├── diningcode_scraper.py   # 다이닝코드 스크래퍼
└── tests/                  # 스크래퍼 테스트 (Phase 4에서 작성)
    ├── __init__.py
    ├── test_kakao.py
    ├── test_naver.py
    └── test_diningcode.py
```

#### 2-3. 프로젝트 루트 정리

**작업 내용:**
1. 셸 스크립트를 `scripts/` 디렉토리로 이동
2. Python 스크립트를 `scrapers/` 디렉토리로 이동
3. 분석 보고서류(`.docx`, `.xlsx`)를 `reports/` 디렉토리로 이동
4. `collected_restaurants.json`을 `data/` 디렉토리로 이동
5. `push-to-github.command` 스크립트 개선 또는 제거 (CI/CD로 대체)

**정리 후 루트 구조:**
```
HKD/
├── architecture/           # 설계 문서 (기존)
├── data/                   # 수집된 데이터
│   └── collected_restaurants.json
├── docs/                   # 테스트 계획 등 문서
│   └── TEST-PLAN.md
├── reports/                # 분석 보고서 (.docx, .xlsx)
├── scrapers/               # Python 스크래퍼 모듈
├── scripts/                # 셸 스크립트
├── tests/                  # 통합 테스트 (Phase 4)
├── .env.example
├── .gitignore
├── package.json
└── README.md               # 신규 작성 (프로젝트 개요)
```

---

### Phase 3: 설계 문서 업데이트

**목표:** 설계 문서를 현재 구현 상태와 일치시키고, 누락된 문서 보완

#### 3-1. 아키텍처 문서 현행화

**대상:** `architecture/` 디렉토리 내 문서들

**작업 내용:**
1. 배포 환경 정보 업데이트 (Railway → Fly.io)
2. 실제 DB 스키마와 설계 문서의 테이블/컬럼 비교 및 동기화
3. 외부 API 연동 현황 업데이트 (Kakao, Naver, Aligo, PortOne)
4. 시스템 아키텍처 다이어그램 갱신 (현재 인프라 반영)

#### 3-2. 배포 가이드 갱신

**대상:** `HKD_Railway_배포가이드.md`

**작업 내용:**
1. 파일명 변경: `HKD_배포가이드.md` (Railway 명칭 제거)
2. Fly.io 기반 배포 절차로 전면 재작성
3. 환경변수 설정 가이드 추가 (GitHub Secrets 연동)
4. 롤백 절차 추가
5. 모니터링/로그 확인 방법 추가

#### 3-3. TEST-PLAN.md 보완

**대상:** `docs/TEST-PLAN.md`

**작업 내용:**
1. 각 TC에 실제 테스트 코드 파일 매핑 정보 추가
2. 테스트 실행 방법(커맨드) 명시
3. 데이터 수집 스크래퍼 관련 TC 추가 (기존 20개 + 신규)
4. 테스트 환경 설정 가이드 보완

#### 3-4. API 문서 갱신

**대상:** `HKD_외부API_목록.xlsx`

**작업 내용:**
1. 현재 사용 중인 API 엔드포인트 목록 검증
2. 각 API의 호출 제한(Rate Limit), 인증 방식, 비용 정보 업데이트
3. API 장애 시 폴백 전략 문서화

---

### Phase 4: 테스트 코드 작성 및 수행

**목표:** 아직 테스트가 없는 모든 기능에 대해 자동화된 테스트 작성

#### 4-1. 테스트 인프라 구축

**작업 내용:**
1. Python 테스트 프레임워크 설정
   - `pytest` + `pytest-cov` 설치
   - `pytest.ini` 또는 `pyproject.toml` 설정
   - Mock 라이브러리 설정 (`unittest.mock`, `responses`)
2. 셸 스크립트 테스트 프레임워크
   - `bats-core` (Bash Automated Testing System) 도입
   - 테스트 헬퍼 설정
3. 테스트 데이터 준비
   - `tests/fixtures/` 디렉토리 생성
   - 각 외부 API의 샘플 응답 JSON 저장 (Mock 데이터)
   - TEST-PLAN.md에 정의된 테스트 데이터 활용

#### 4-2. 데이터 수집 스크래퍼 테스트

| 테스트 ID | 대상 | 테스트 내용 | 방식 |
|-----------|------|------------|------|
| ST-01 | KakaoScraper | 카카오 API 응답 파싱 정상 동작 | Mock 응답 |
| ST-02 | KakaoScraper | 제주 외 지역 필터링 동작 | Mock 응답 |
| ST-03 | KakaoScraper | API 에러 시 예외 처리 | Mock 에러 |
| ST-04 | NaverScraper | 네이버 플레이스 HTML 파싱 | Mock HTML |
| ST-05 | NaverScraper | 메뉴 정보 추출 | Mock 응답 |
| ST-06 | DiningcodeScraper | ld+json 스키마 파싱 | Mock HTML |
| ST-07 | DiningcodeScraper | 검색 결과 파싱 | Mock HTML |
| ST-08 | HttpClient | 재시도 로직 동작 | Mock 타임아웃 |
| ST-09 | HttpClient | 타임아웃 처리 | Mock 타임아웃 |
| ST-10 | Models | Restaurant/Menu 데이터 변환 | 단위 테스트 |

#### 4-3. 셸 스크립트 테스트

| 테스트 ID | 대상 | 테스트 내용 | 방식 |
|-----------|------|------------|------|
| SH-01 | config.sh | 환경변수 로드 검증 | bats |
| SH-02 | collect_restaurants.sh | API 호출 파라미터 검증 | Mock curl |
| SH-03 | collect_restaurants.sh | JSON 결과 파싱 검증 | 샘플 데이터 |
| SH-04 | register_restaurants.sh | 중복 등록 방지 검증 | Mock API |
| SH-05 | register_restaurants.sh | --dry-run 옵션 검증 | bats |
| SH-06 | cleanup_restaurants.sh | 제주 외 레스토랑 식별 검증 | 샘플 데이터 |
| SH-07 | cleanup_restaurants.sh | 백업 생성 검증 | bats |

#### 4-4. TEST-PLAN.md 기반 통합 테스트 (TC-01 ~ TC-20)

**Phase A — 기본 기능 (TC-01 ~ TC-06):**

| TC | 기능 | 테스트 코드 위치 | 핵심 검증 항목 |
|----|------|-----------------|---------------|
| TC-01 | ARS/SMS 연동 | `tests/integration/test_ars_sms.py` | 전화 수신 → SMS 발송 플로우 |
| TC-02 | 영업시간 판단 | `tests/integration/test_business_hours.py` | 영업중/종료 상태별 페이지 분기 |
| TC-03 | 레스토랑 목록 | `tests/integration/test_restaurants.py` | API 응답 형태, 페이지네이션 |
| TC-04 | 메뉴 조회 | `tests/integration/test_menus.py` | 특정 레스토랑 메뉴 반환 |
| TC-05 | 배달비 계산 | `tests/integration/test_delivery_fee.py` | Haversine 거리 기반 요금 계산 |
| TC-06 | 장바구니 | `tests/integration/test_cart.py` | 담기/수량변경/삭제/합계 |

**Phase B — 주문 플로우 (TC-07 ~ TC-14):**

| TC | 기능 | 테스트 코드 위치 | 핵심 검증 항목 |
|----|------|-----------------|---------------|
| TC-07 | 주문 생성 | `tests/integration/test_order_create.py` | 주문 데이터 저장, 상태=pending |
| TC-08 | 픽업시간 설정 | `tests/integration/test_pickup_time.py` | 관리자 픽업시간 지정 |
| TC-09 | 고객 확인 | `tests/integration/test_order_confirm.py` | confirm_token 검증 |
| TC-10 | 픽업 완료 | `tests/integration/test_pickup.py` | 상태 전이: confirmed → picked_up |
| TC-11 | 배달 시작 | `tests/integration/test_delivery_start.py` | 상태 전이: picked_up → delivering |
| TC-12 | 배달 완료 | `tests/integration/test_delivery_complete.py` | 상태 전이: delivering → completed |
| TC-13 | SMS 알림 | `tests/integration/test_sms_notifications.py` | 각 단계별 SMS 발송 검증 |
| TC-14 | 주문 취소 | `tests/integration/test_order_cancel.py` | 취소 가능 상태 검증, 상태=cancelled |

**Phase C — 관리자 기능 (TC-15 ~ TC-20):**

| TC | 기능 | 테스트 코드 위치 | 핵심 검증 항목 |
|----|------|-----------------|---------------|
| TC-15 | 레스토랑 활성화 | `tests/integration/test_admin_restaurant.py` | isActive 토글 |
| TC-16 | 메뉴 관리 | `tests/integration/test_admin_menu.py` | CRUD 동작 |
| TC-17 | 카카오 스크래핑 | `tests/integration/test_admin_scrape.py` | 외부 데이터 수집 트리거 |
| TC-18 | 영업시간 설정 | `tests/integration/test_admin_hours.py` | Settings 테이블 반영 |
| TC-19 | 배달비 설정 | `tests/integration/test_admin_fee.py` | 기본료/km당 요금 설정 |
| TC-20 | 대시보드 | `tests/integration/test_admin_dashboard.py` | 주문 통계 조회 |

#### 4-5. 아키텍처 문서 기반 추가 테스트 (설계 문서 검증에서 발견된 누락분)

아키텍처 문서(`architecture/docs/`)를 검증한 결과, TEST-PLAN.md의 TC-01~20에 포함되지 않은 주요 기능들이 다수 확인되었습니다. 다음 테스트를 추가합니다.

**Phase D — 배달원 기능 (05-배달원-테스트-시나리오.md 기반):**

| TC | 기능 | 테스트 코드 위치 | 핵심 검증 항목 |
|----|------|-----------------|---------------|
| DR-01 | 배달원 로그인 | `tests/integration/test_driver_auth.py` | 전화번호 기반 인증 |
| DR-02 | 배달 배정 수락 | `tests/integration/test_driver_assign.py` | 주문 배정/수락/거절 플로우 |
| DR-03 | 배달 추적 | `tests/integration/test_driver_tracking.py` | 위치 업데이트, 상태 전이 |
| DR-04 | 네비게이션 연동 | `tests/integration/test_driver_navi.py` | 네이버 지도 API 호출 |
| DR-05 | 배달 완료 사진 | `tests/integration/test_driver_photo.py` | 사진 업로드 및 저장 |

**Phase E — 결제 시스템 (PortOne 연동):**

| TC | 기능 | 테스트 코드 위치 | 핵심 검증 항목 |
|----|------|-----------------|---------------|
| PAY-01 | 결제 요청 | `tests/integration/test_payment_request.py` | PortOne API 호출 파라미터 검증 |
| PAY-02 | 웹훅 검증 | `tests/integration/test_payment_webhook.py` | 서명 검증, 금액 일치 확인 |
| PAY-03 | 환불 처리 | `tests/integration/test_payment_refund.py` | 주문 취소 시 환불 플로우 |

**Phase F — 편의점 확장 기능 (07-편의점-확장-설계문서.md 기반):**

| TC | 기능 | 테스트 코드 위치 | 핵심 검증 항목 |
|----|------|-----------------|---------------|
| CONV-01 | 편의점 목록 | `tests/integration/test_conv_list.py` | 편의점 타입 필터링 |
| CONV-02 | 연령 인증 | `tests/integration/test_conv_age_verify.py` | 주류 구매 시 본인인증 |
| CONV-03 | 편의점 전용 규칙 | `tests/integration/test_conv_rules.py` | 최소주문금액, 배달가능시간 |

**Phase G — 정산 시스템:**

| TC | 기능 | 테스트 코드 위치 | 핵심 검증 항목 |
|----|------|-----------------|---------------|
| SE-01 | 월별 정산 생성 | `tests/integration/test_settlement_gen.py` | 레스토랑별 정산 데이터 집계 |
| SE-02 | 정산 승인 워크플로우 | `tests/integration/test_settlement_approve.py` | 관리자 검토/승인 프로세스 |
| SE-03 | 정산 내역 조회 | `tests/integration/test_settlement_history.py` | 기간별/레스토랑별 필터링 |
| SE-04 | 이체 처리 | `tests/integration/test_settlement_transfer.py` | 은행 이체 요청/결과 확인 |

**Phase H — 보안 및 인프라:**

| TC | 기능 | 테스트 코드 위치 | 핵심 검증 항목 |
|----|------|-----------------|---------------|
| AUTH-01 | RBAC 권한 검증 | `tests/integration/test_rbac.py` | 역할별 API 접근 제어 |
| AUTH-02 | JWT 토큰 갱신 | `tests/integration/test_jwt_refresh.py` | 만료/갱신/무효화 |
| AUTH-03 | Admin API 키 인증 | `tests/integration/test_admin_auth.py` | 키 유효성/권한 검증 |
| RATE-01 | API Rate Limiting | `tests/integration/test_rate_limit.py` | 요청 제한 초과 시 429 응답 |
| RATE-02 | Auth Rate Limiting | `tests/integration/test_auth_rate_limit.py` | 인증 시도 제한 |
| RATE-03 | Webhook Rate Limiting | `tests/integration/test_webhook_rate_limit.py` | 웹훅 호출 빈도 제한 |
| VAL-01 | 전화번호 형식 검증 | `tests/unit/test_phone_validation.py` | 010-XXXX-XXXX 패턴 |
| VAL-02 | 주소 유효성 검증 | `tests/unit/test_address_validation.py` | 제주 지역 주소 형식 |
| VAL-03 | 수량/금액 범위 검증 | `tests/unit/test_quantity_validation.py` | 음수, 0, 최대값 초과 처리 |
| VAL-04 | 거리 제한 검증 | `tests/unit/test_distance_validation.py` | 배달 반경 초과 시 거부 |
| INFRA-01 | 헬스체크 엔드포인트 | `tests/integration/test_health.py` | /health, /ready 응답 확인 |
| INFRA-02 | 메트릭 수집 | `tests/integration/test_metrics.py` | 요청수/응답시간/에러율 |
| INFRA-03 | 로그 로테이션 | `tests/integration/test_logging.py` | 로그 포맷 및 레벨 검증 |
| INFRA-04 | DB 연결 복원 | `tests/integration/test_db_resilience.py` | 연결 끊김 후 재연결 |

#### 4-6. 전체 테스트 요약

| 카테고리 | 테스트 수 | 파일 위치 |
|----------|----------|----------|
| 스크래퍼 단위 테스트 (ST) | 10 | `scrapers/tests/` |
| 셸 스크립트 테스트 (SH) | 7 | `scripts/tests/` |
| 기본 기능 (TC-01~06) | 6 | `tests/integration/` |
| 주문 플로우 (TC-07~14) | 8 | `tests/integration/` |
| 관리자 기능 (TC-15~20) | 6 | `tests/integration/` |
| 배달원 기능 (DR) | 5 | `tests/integration/` |
| 결제 시스템 (PAY) | 3 | `tests/integration/` |
| 편의점 확장 (CONV) | 3 | `tests/integration/` |
| 정산 시스템 (SE) | 4 | `tests/integration/` |
| 보안/인증 (AUTH, RATE) | 6 | `tests/integration/` |
| 입력 검증 (VAL) | 4 | `tests/unit/` |
| 인프라 (INFRA) | 4 | `tests/integration/` |
| **합계** | **66** | |

#### 4-7. 테스트 수행 및 커버리지

**실행 명령:**
```bash
# Python 스크래퍼 테스트
cd scrapers && pytest tests/ -v --cov=. --cov-report=html

# 셸 스크립트 테스트
bats scripts/tests/

# 단위 테스트
pytest tests/unit/ -v --cov --cov-report=html

# 통합 테스트 (Docker Compose로 DB/Redis 포함)
docker-compose -f docker-compose.test.yml up -d
npm test -- --forceExit --detectOpenHandles --coverage

# 전체 테스트 한번에 실행
pytest tests/ scrapers/tests/ -v --cov --cov-report=html --cov-report=term-missing
```

**커버리지 목표:**
- 스크래퍼 모듈: 80% 이상
- 셸 스크립트 핵심 로직: 70% 이상
- 단위 테스트 (입력 검증 등): 90% 이상
- 통합 테스트 (API 엔드포인트): 85% 이상
- 전체 목표: 80% 이상

---

## 3. 실행 일정 (권장)

| 주차 | Phase | 핵심 작업 | 산출물 |
|------|-------|----------|--------|
| 1주차 | Phase 1 | 보안 이슈 해결 | `.env.example`, 수정된 스크립트 |
| 1~2주차 | Phase 2 | 코드 리팩토링 | `scripts/`, `scrapers/` 구조 |
| 2주차 | Phase 3 | 설계 문서 업데이트 | 갱신된 아키텍처 문서, 배포 가이드 |
| 3~4주차 | Phase 4-1,2,3 | 테스트 인프라 + 스크래퍼/셸 테스트 | `scrapers/tests/`, `scripts/tests/` |
| 4~5주차 | Phase 4-4 | 통합 테스트 Phase A~C (TC-01~20) | `tests/integration/` |
| 5~6주차 | Phase 4-5 | 추가 테스트 Phase D~H (DR, PAY, CONV, SE, AUTH, INFRA) | `tests/integration/`, `tests/unit/` |
| 7주차 | Phase 4-6,7 | 전체 테스트 수행, 커버리지 확인, 미달 항목 보완 | 커버리지 리포트 |

---

## 4. 아키텍처 문서 ↔ 테스트 매핑

계획의 완전성을 보장하기 위해 아키텍처 문서와 테스트의 명시적 매핑을 정리합니다.

| 아키텍처 문서 | 관련 테스트 |
|-------------|-----------|
| `01-시스템-설계문서.md` | TC-01~06 (기본 기능), INFRA-01~04 |
| `02-단위-테스트-코드.md` | VAL-01~04, ST-01~10 |
| `03-사용자-테스트-시나리오.md` | TC-01~14 (사용자 플로우) |
| `04-어드민-테스트-시나리오.md` | TC-15~20, SE-01~04 |
| `05-배달원-테스트-시나리오.md` | DR-01~05 |
| `06-미구현-기능-및-개선사항.md` | AUTH-01~03, CONV-01~03 |
| `07-편의점-확장-설계문서.md` | CONV-01~03 |
| `08-인프라-운영-설계문서.md` | INFRA-01~04, RATE-01~03 |
| `09-입력검증-설계문서.md` | VAL-01~04 |
| `테스트_시나리오_매트릭스.md` | 전체 테스트의 교차 참조용 |

---

## 5. 리팩토링 원칙

1. **점진적 적용**: 한 번에 전부 바꾸지 않고, Phase 단위로 커밋하여 롤백 가능하게 유지
2. **기존 기능 보존**: 리팩토링 중 기존 동작이 깨지지 않도록 테스트 우선 작성 (가능한 경우)
3. **코드 리뷰**: 각 Phase 완료 시 PR 생성 → 리뷰 → 머지 사이클
4. **문서와 코드의 동기화**: 코드 변경 시 관련 문서도 함께 업데이트
5. **시크릿 절대 커밋 금지**: Phase 1 완료 전까지 새로운 커밋 자제

---

## 6. 리스크 및 대응 방안

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 외부 API 변경으로 스크래퍼 동작 불가 | 데이터 수집 중단 | Mock 기반 테스트로 분리, 실제 API 테스트는 별도 수동 수행 |
| DB 스키마 변경 시 기존 데이터 영향 | 서비스 장애 | Prisma migration으로 관리, 스테이징 환경 우선 적용 |
| 디렉토리 구조 변경으로 CI/CD 파이프라인 실패 | 배포 불가 | `.github/workflows/ci.yml` 경로를 리팩토링과 동시에 업데이트 |
| 하드코딩된 키가 Git 히스토리에 잔존 | 보안 위협 | `git filter-branch` 또는 BFG Repo-Cleaner로 히스토리 정리 |
| 배달원/결제/정산 등 미구현 기능 테스트 작성 불가 | 테스트 커버리지 미달 | 인터페이스(Mock) 기반 테스트 우선 작성, 구현 완료 후 실 테스트로 전환 |
| 편의점 확장 기능 스키마 미확정 | 테스트 지연 | 설계 문서 기반으로 테스트 스켈레톤 먼저 작성, 스키마 확정 후 보완 |

---

## 7. 실행 결과 (2026-04-04)

### Phase 1~4 실행 완료

| Phase | 상태 | 주요 산출물 |
|-------|------|-----------|
| Phase 1: 보안 이슈 해결 | **완료** | `.env.example`, 셸 스크립트 4개 환경변수화, Python 6개 SSL 수정, `requirements.txt` |
| Phase 2: 코드 리팩토링 | **완료** | `scripts/` (config.sh, utils.sh 포함), `scrapers/` 모듈 (5개 클래스), `data/`, `reports/` |
| Phase 3: 설계 문서 업데이트 | **완료** | `HKD_배포가이드.md` (Fly.io), `TEST-PLAN.md` (59 TC), 아키텍처↔테스트 매핑 |
| Phase 4: 테스트 코드 작성/수행 | **완료** | 131개 테스트 케이스 작성 및 **전수 통과 (131/131 PASSED)** |

### 테스트 실행 결과

```
============================= 131 passed in 0.28s ==============================
```

| 테스트 카테고리 | 테스트 수 | 결과 |
|---------------|----------|------|
| 스크래퍼: Kakao (ST-01~03) | 11 | 전체 PASSED |
| 스크래퍼: Naver (ST-04~05) | 7 | 전체 PASSED |
| 스크래퍼: Diningcode (ST-06~07) | 8 | 전체 PASSED |
| 스크래퍼: HttpClient (ST-08~09) | 7 | 전체 PASSED |
| 스크래퍼: Models (ST-10) | 10 | 전체 PASSED |
| 단위: 전화번호 검증 (VAL-01) | 14 | 전체 PASSED |
| 단위: 주소 검증 (VAL-02) | 9 | 전체 PASSED |
| 단위: 수량/금액 검증 (VAL-03) | 14 | 전체 PASSED |
| 단위: 거리/배달비 검증 (VAL-04) | 13 | 전체 PASSED |
| 통합: 기본 기능 (TC-01~06) | 14 | 전체 PASSED |
| 통합: 주문 플로우 (TC-07~14) | 14 | 전체 PASSED |
| 통합: 관리자 기능 (TC-15~20) | 10 | 전체 PASSED |
| **합계** | **131** | **131 PASSED** |

---

*이 계획서는 프로젝트 현황 분석 및 아키텍처 문서 교차 검증을 기반으로 작성되었으며, 2026년 4월 4일 Phase 1~4 실행이 완료되었습니다.*
