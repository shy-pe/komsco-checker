# KOMSCO PulseBoard

서버 기반 저장, 프론트 조회, 이벤트 알림을 갖춘 고객사이트 헬스체크 대시보드입니다.

## Stack

- Next.js App Router
- React 19
- Vercel Functions + Cron Jobs
- Upstash Redis REST storage
- Telegram Bot API notifications

## Main Files

- `app/page.tsx`: 메인 대시보드 페이지
- `app/api/health/route.ts`: 대시보드 조회 + 수동 점검 실행
- `app/api/cron/health/route.ts`: 스케줄 기반 서버 점검 + 알림
- `app/api/sites/route.ts`: 서버 사이트 목록 조회
- `data/sites.json`: 운영 사이트 목록
- `lib/monitoring.ts`: 점검, 저장, 알림 오케스트레이션

## Environment Variables

- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_FAILURE_THRESHOLD` (기본값: `3`)

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

- 사이트가 한 번이라도 실패하면 대시보드에 고정 경고와 화면 토스트가 표시됩니다. 경고음은 화면의 설정에서 켜거나 끌 수 있습니다.
- 텔레그램은 같은 사이트가 연속 3회 실패할 때 한 번 전송하며, 이후 복구되면 복구 알림을 보냅니다. 횟수는 `TELEGRAM_FAILURE_THRESHOLD`로 조정할 수 있습니다.
- 기본 크론은 5분마다 실행됩니다. Vercel Hobby 플랜은 하루 1회 크론만 지원하므로, 이 주기를 사용하려면 Pro 이상 또는 별도 스케줄러가 필요합니다.

## Current Retention

- 최근 원본 샘플: 사이트당 180개
- 시간 단위 집계: 사이트당 최근 30일
- 최근 이벤트 알림: 80건
