# Deployment Guide

## Architecture

- Frontend: Next.js dashboard
- Server checks: `app/api/health/route.ts`
- Scheduled monitoring: GitHub Actions → `app/api/cron/health/route.ts`
- Site registry: `data/sites.json`
- Server store: Upstash Redis REST env vars
- Alerts: Telegram Bot API env vars

## Required Environment Variables

- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ALERT_FAILURE_THRESHOLD` (기본값: `1`)
- `MONITOR_INTERVAL_MINUTES` (기본값: `5`)
- `MONITOR_TIMEOUT_MS` (기본값: `8000`)

## Monitoring Flow

1. GitHub Actions calls `/api/cron/health` every 5 minutes
2. Server checks all sites from `data/sites.json`
3. Results are persisted to the server store
4. 첫 실패는 화면 경고·경고음·Telegram 알림으로 처리됩니다.
5. 복구되면 화면과 Telegram에 복구 메시지가 표시됩니다.
6. Frontend reads the stored monitor state from `/api/health`

## Notes

- Manual checks update the shared server store.
- If Redis env vars are missing, the app falls back to memory mode.
- The default schedule is every 5 minutes (`*/5 * * * *`, UTC) in `.github/workflows/monitor.yml`.
