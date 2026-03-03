# clash-status

`https://www.githubstatus.com/` 스타일을 참고한 Clash 상태 페이지 프로토타입입니다.

## 목표
- `api.clash.kr` / `clash.kr`를 주기적으로 점검
- 현재 단계 판정 기준: **HTTP 404가 아니면 정상**
- Traefik이 upstream 미탐지 시 404를 반환하는 운영 특성을 반영

## Tech Stack
- Runtime: Node.js 20+
- Server: Express + TypeScript
- Monitoring: 내장 스케줄러(`setInterval`) + Fetch API
- Storage:
  - 기본: 메모리 버퍼
  - 선택: PostgreSQL (`DATABASE_URL` 설정 시 자동 사용, 계정 정보는 별도 env 지원)
- UI: 정적 HTML/CSS/Vanilla JS

## 기능
- 컴포넌트별 현재 상태, 응답코드, 응답시간
- 24h/7d 업타임 비율
- 최근 24시간 히스토리 바
- 최근 72시간 인시던트 자동 감지
- 수동 즉시 점검 버튼

## 실행
```bash
npm install
cp .env.example .env
npm run dev
```

기본 포트는 `8080`이며 접속 주소는 `http://localhost:8080` 입니다.

## 환경 변수
`.env` 파일은 서버 시작 시 자동 로드됩니다.

- `PORT` (default: `8080`)
- `CHECK_INTERVAL_MS` (default: `30000`)
- `REQUEST_TIMEOUT_MS` (default: `5000`)
- `MEMORY_SAMPLES_PER_SERVICE` (default: `20000`)
- `DATABASE_URL` (optional, PostgreSQL)
- `DATABASE_USERNAME` / `DATABASE_PASSWORD` (optional, `DATABASE_URL`와 함께 사용 가능)
  - 호환 alias: `POSTGRES_USERNAME` / `POSTGRES_PASSWORD`, `POSTGRES_USER` / `POSTGRES_PASSWORD`
  - `PGUSER` / `PGPASSWORD`는 `DATABASE_URL`에 사용자/비밀번호가 없을 때만 fallback으로 사용
- `SERVICES_JSON` (optional)

`SERVICES_JSON` 예시:
```json
[
  { "id": "api", "name": "API", "url": "https://api.clash.kr/" },
  { "id": "web", "name": "Web", "url": "https://clash.kr/" }
]
```

## API
- `GET /api/status`: 상태 대시보드 데이터
- `POST /api/check-now`: 즉시 체크 실행
- `GET /internal/healthz`: 이 서비스 자체의 health

## 향후 계획
전용 헬스 엔드포인트 도입 계획은 아래 문서에 정리했습니다.

- [docs/health-endpoint-plan.md](docs/health-endpoint-plan.md)
