# PulseBoard Guide

## Entry Points

- Frontend page: `app/page.tsx`
- Health API: `app/api/health/route.ts`
- Sites API: `app/api/sites/route.ts`
- Site registry: `data/sites.json`

## What To Edit Before Release

- Front version label: `components/health-dashboard.tsx`
- API payload version: `lib/health-check.ts`
- Site list: `data/sites.json`

## Run Locally

```bash
npm install
npm run dev
```

## Deploy To Vercel

1. Push this folder to GitHub.
2. Import the repository in Vercel.
3. Let Vercel detect Next.js automatically.
4. Deploy without a custom build command.

## Current Storage Policy

- Raw samples: last 180 per site
- Hourly archive: last 30 days per site
