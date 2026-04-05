// Conventional Commits 규칙
// 커밋 메시지 형식: type(scope): 설명
// 예: feat(backend): 주문 API 추가
//     fix(frontend): 로그인 버그 수정
//     docs: README 업데이트

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 타입 필수
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 새 기능
        'fix',      // 버그 수정
        'docs',     // 문서 변경
        'style',    // 포맷팅 (코드 의미 변경 없음)
        'refactor', // 리팩토링
        'perf',     // 성능 개선
        'test',     // 테스트 추가/수정
        'build',    // 빌드/의존성 변경
        'ci',       // CI 설정 변경
        'chore',    // 기타 잡무
        'revert',   // 되돌리기
      ],
    ],
    // scope 선택사항
    'scope-enum': [
      1,
      'always',
      [
        'backend',
        'frontend',
        'scrapers',
        'infra',
        'db',
        'scripts',
        'deps',
      ],
    ],
    // 제목 72자 이하
    'header-max-length': [2, 'always', 72],
    // 제목 빈칸 불가
    'subject-empty': [2, 'never'],
    // 타입 빈칸 불가
    'type-empty': [2, 'never'],
  },
};
