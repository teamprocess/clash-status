# Dedicated Health Endpoint Plan

## 0) 현재 프로토타입 상태 (2026-03-03)
- 점검 대상: `https://api.clash.kr/`, `https://clash.kr/`
- 판정 기준: HTTP status code가 `404`가 아니면 정상
- 장애 시나리오: Traefik이 백엔드 미탐지 시 `404` 반환

## 1) API 전용 헬스 엔드포인트 도입
- 엔드포인트: `GET /health/live`, `GET /health/ready`
- `live`: 프로세스 생존 여부만 확인 (항상 빠르게 200)
- `ready`: DB/외부 의존성 최소 확인 후 준비 완료 시 200
- 반환 포맷 예시:
  - `{"status":"ok","checks":{"db":"ok"},"timestamp":"..."}`

## 2) Web 전용 헬스 엔드포인트 도입
- 정적 웹 서버(또는 edge)에서 `GET /healthz` 추가
- 빌드 아티팩트 접근 가능 여부 + 필수 정적 리소스 존재 확인
- 응답은 200 + 짧은 JSON(또는 plain text)

## 3) 모니터 판정 규칙 전환
- 기존: `status != 404`
- 전환: health endpoint에서 `status === 200` + 응답 바디 스키마 검증
- 이행 기간(1~2주):
  - 기존 체크와 신규 체크 병행
  - 불일치 케이스 수집 후 임계치 튜닝

## 4) 운영 고도화
- SLO 정의:
  - API 가용성 99.9%
  - Web 가용성 99.95%
- 알림 채널 연동 (Slack/PagerDuty)
- 인시던트 자동 생성 정책 (5분 이상 down 지속 시)

## 5) 배포 전략
- Blue/Green 또는 canary 배포 시 readiness 기준 강화
- 헬스체크 실패 인스턴스 자동 제외

## 6) 데이터 보존
- 체크 원본 데이터 30~90일 보존
- 장기 통계(일 단위) 별도 집계 테이블 생성
