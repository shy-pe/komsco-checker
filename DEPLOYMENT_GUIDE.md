# Deployment Guide

## Architecture

- Frontend: Next.js dashboard
- Server checks: `app/api/health/route.ts`
- Scheduled monitoring: `app/api/cron/health/route.ts`
- Site registry: `data/sites.json`
- Server store: Upstash Redis REST env vars
- Alerts: Telegram Bot API env vars

## Required Environment Variables

- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_FAILURE_THRESHOLD` (기본값: `3`)

## Monitoring Flow

1. Vercel cron calls `/api/cron/health`
2. Server checks all sites from `data/sites.json`
3. Results are persisted to the server store
4. 첫 실패는 대시보드 화면 경고로 즉시 표시됩니다.
5. 같은 사이트가 3회 연속 실패하면 Telegram 메시지가 전송되고, 이후 복구되면 복구 메시지가 전송됩니다.
6. Frontend reads the stored monitor state from `/api/health`

## Notes

- Manual checks update the shared server store.
- If Redis env vars are missing, the app falls back to memory mode.
- The default cron schedule is every 5 minutes (`*/5 * * * *`, UTC). Vercel Hobby plans only allow one cron run per day; use Pro or an external scheduler for this interval.
