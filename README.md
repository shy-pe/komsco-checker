# KOMSCO PulseBoard

서버 기반 저장, 프론트 조회, 이벤트 알림을 갖춘 고객사이트 헬스체크 대시보드입니다.

## Stack

- Next.js App Router
- React 19
- Vercel Functions + GitHub Actions scheduler
- Upstash Redis REST storage
- Telegram Bot API notifications

## Main Files

- `app/page.tsx`: 메인 대시보드 페이지
- `app/api/health/route.ts`: 대시보드 조회 + 수동 점검 실행
- `app/api/control/route.ts`: 관리자 비밀키 기반 전체 모니터링 일시정지/재개
- `app/api/cron/health/route.ts`: 스케줄 기반 서버 점검 + 알림
- `app/api/sites/route.ts`: 서버 사이트 목록 조회
- `data/sites.json`: 운영 사이트 목록
- `lib/monitoring.ts`: 점검, 저장, 알림 오케스트레이션

## Environment Variables

- `CRON_SECRET`: GitHub Actions cron 호출 보호용 비밀키
- `DASHBOARD_CONTROL_SECRET`: 웹에서 전체 모니터링을 일시정지/재개할 때 쓰는 관리자 비밀키
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ALERT_FAILURE_THRESHOLD` (기본값: `1`)
- `MONITOR_INTERVAL_MINUTES` (기본값: `5`)
- `MONITOR_TIMEOUT_MS` (기본값: `8000`)

## Local Development

```bash
npm install
npm run dev
npm run build
```

## Deploy To Vercel

1. GitHub 저장소에 push 합니다.
2. Vercel에서 저장소를 import 합니다.
3. 환경변수를 설정합니다.
4. 배포 후 `data/sites.json` 기준으로 서버 체크가 동작합니다.
5. 크론 스케줄과 텔레그램은 환경변수 설정 후 활성화됩니다.

## Alerts

- 사이트가 한 번 실패하면 대시보드 경고·화면 토스트·경고음·텔레그램 알림이 같은 장애 이벤트를 기준으로 동작합니다.
- 복구 시에도 화면과 텔레그램에 복구 상태가 표시됩니다. 연속 실패 임계값은 `ALERT_FAILURE_THRESHOLD`로 변경할 수 있습니다.
- 자동 점검은 GitHub Actions가 5분마다 `/api/cron/health`를 호출합니다. 주기 변경 시 워크플로 스케줄과 `MONITOR_INTERVAL_MINUTES`를 함께 맞춥니다.
- 웹에서 관리자 비밀키를 입력하면 전체 모니터링을 일시정지하거나 재개할 수 있습니다.

## Current Retention

- 최근 원본 샘플: 사이트당 180개
- 시간 단위 집계: 사이트당 최근 30일
- 최근 이벤트 알림: 80건