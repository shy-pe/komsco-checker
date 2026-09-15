# Deployment Guide

## Architecture

- Frontend: Next.js dashboard
- Server checks: `app/api/health/route.ts`
- Scheduled monitoring: GitHub Actions -> `app/api/cron/health/route.ts`
- Manual/global control: `app/api/control/route.ts`
- Site registry: `data/sites.json`
- Server store: Upstash Redis REST env vars
- Alerts: Telegram Bot API env vars

## Required Environment Variables

- `CRON_SECRET`
- `DASHBOARD_CONTROL_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ALERT_FAILURE_THRESHOLD` (default: `1`)
- `MONITOR_INTERVAL_MINUTES` (default: `5`)
- `MONITOR_TIMEOUT_MS` (default: `8000`)

## Upstash Setup

1. Create an Upstash Redis database.
2. Copy the REST URL and REST token into Vercel environment variables.
3. Add the same variables to GitHub Actions if you use repository-level secrets or vars for local tooling.
4. Redeploy the app so the dashboard starts writing monitoring history into Redis.

## Monitoring Flow

1. GitHub Actions calls `/api/cron/health` every 5 minutes.
2. Server checks all sites from `data/sites.json`.
3. Results are persisted to the shared store.
4. The dashboard shows a warning banner, toast, sound, and Telegram alert when an incident is detected.
5. Recovery is reported to the dashboard and Telegram as well.
6. Frontend reads the stored monitor state from `/api/health`.
7. If the dashboard admin secret is used to pause monitoring, cron and manual checks skip new site requests until it is resumed.

## Notes

- Manual checks update the shared server store.
- If Redis env vars are missing, the app falls back to memory mode.
- The default schedule is every 5 minutes (`*/5 * * * *`, UTC) in `.github/workflows/monitor.yml`.