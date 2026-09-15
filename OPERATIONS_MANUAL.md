# KOMSCO PulseBoard 통합 운영 매뉴얼

이 문서는 로컬 개발, GitHub 배포, Vercel 운영, 모니터링 제어와 장애 대응을 한곳에 정리한 운영 기준입니다.

## 서비스 구성

| 구분 | 역할 |
| --- | --- |
| Next.js / Vercel | 대시보드와 API 실행 |
| GitHub Actions | 5분마다 점검 API를 호출하는 스케줄러 |
| Upstash Redis | 점검 결과, 이력, 알림, 일시정지 상태의 영속 저장소 |
| Telegram Bot API | 실패 임계치 도달 및 복구 알림 |
| `data/sites.json` | 점검 대상 사이트의 단일 관리 목록 |

모니터링은 GitHub Actions가 `GET /api/cron/health`를 호출하면서 실행됩니다. 한 번의 실행에서는 등록된 사이트마다 GET 요청을 한 번만 보냅니다. 대시보드의 자동 조회는 이미 저장된 결과를 읽기만 하므로, 화면을 열어 두는 것만으로 대상 사이트에 추가 점검 요청을 보내지 않습니다.

## 운영 전 필수 설정

값은 절대 Git에 커밋하지 않습니다. `.env.local`, Vercel 환경 변수, GitHub Secrets를 사용합니다.

| 환경 변수 | 저장 위치 | 용도 |
| --- | --- | --- |
| `CRON_SECRET` | Vercel Production + GitHub Actions Secret | 스케줄 API 인증. 양쪽 값이 반드시 같아야 함 |
| `DASHBOARD_CONTROL_SECRET` | Vercel Production | 대시보드의 전체 모니터링 일시정지/재개 관리자 비밀키 |
| `UPSTASH_REDIS_REST_URL` | Vercel Production | Upstash Console의 REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel Production | Upstash Console의 REST token |
| `TELEGRAM_BOT_TOKEN` | Vercel Production | Telegram BotFather에서 발급한 봇 토큰 |
| `TELEGRAM_CHAT_ID` | Vercel Production | 알림을 받을 개인/그룹 채팅 ID |
| `ALERT_FAILURE_THRESHOLD` | Vercel Production | 알림을 발생시킬 연속 실패 횟수. 기본값 `1` |
| `MONITOR_INTERVAL_MINUTES` | Vercel Production | 화면에 표시하는 점검 주기. 기본값 `5` |
| `MONITOR_TIMEOUT_MS` | Vercel Production + GitHub Actions Variable | 사이트별 요청 제한 시간(ms). 기본값 `8000` |

현재 GitHub Actions 스케줄은 `*/5 * * * *`입니다. 무료 스케줄은 실행 지연이 발생할 수 있으므로, 1~2분 단위로 바꾸기보다 5분 기준을 운영값으로 유지합니다. 주기를 변경할 경우 `.github/workflows/monitor.yml`의 cron 표현식과 `MONITOR_INTERVAL_MINUTES`를 같이 변경합니다.

### Upstash Redis 연결

1. Upstash Console에서 Redis 데이터베이스를 만듭니다.
2. Database의 **REST API** 영역에서 REST URL과 REST Token을 복사합니다.
3. Vercel Project → Settings → Environment Variables에 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`을 Production으로 추가합니다.
4. 새 배포를 실행합니다.
5. 대시보드의 `점검 이력 저장` 표시가 `정상`이고 API 응답의 `storage.provider`가 `upstash-rest`인지 확인합니다.

두 값이 없거나 Redis 요청이 실패하면 서비스는 멈추지 않고 일시적인 메모리 저장소로 동작합니다. 이 경우 Vercel 인스턴스가 바뀌면 이력과 일시정지 상태가 사라질 수 있으므로 운영 환경에서는 Redis 연결을 완료해야 합니다.

### Telegram 연결

1. BotFather에서 봇을 만들고 토큰을 발급받습니다.
2. 알림을 받을 채팅 또는 그룹에 봇을 추가한 뒤 Chat ID를 확인합니다.
3. Vercel Production에 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`를 추가하고 재배포합니다.
4. 테스트 채팅에서 봇 메시지 수신을 확인합니다.

임계치 기본값은 1회입니다. 즉 첫 실패에 화면 경고와 저장된 이벤트가 생기며, Telegram은 실패 임계치 도달과 복구 시점에 전송됩니다. 여러 실패를 허용하려면 `ALERT_FAILURE_THRESHOLD=2` 또는 `3`으로 올립니다.

## 로컬 실행과 검증

### 최초 준비

```powershell
npm install
Copy-Item .env.example .env.local
```

`.env.local`에 개발용 비밀값을 넣습니다. 실제 운영 비밀값을 공유하거나 커밋하지 않습니다. Redis/Telegram 값이 비어 있어도 화면과 기본 기능을 확인할 수 있지만, 이력은 로컬 프로세스의 메모리에만 남습니다.

### 실행

```powershell
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 종료는 실행 중인 터미널에서 `Ctrl+C`를 누릅니다.

### 배포 전 필수 검증

```powershell
npm run build
```

아래 항목을 확인합니다.

1. 대시보드에서 대상 사이트 목록과 최근 결과가 표시됩니다.
2. `지금 점검`은 한 번만 실행해 결과를 갱신합니다.
3. `DASHBOARD_CONTROL_SECRET` 입력 후 `모니터링 일시정지`를 누르면 수동 점검과 스케줄 점검이 모두 건너뛰어집니다.
4. `모니터링 재개` 후 최근 제어 이력에 정지와 재개 기록이 남습니다.
5. `/api/health` 응답에서 `storage`, `alerting`, `monitor.control` 상태가 기대값과 일치합니다.

## 배포 절차

### GitHub 반영

```powershell
git status
git add <변경 파일>
git commit -m "설명"
git push origin main
```

저장소는 `https://github.com/shy-pe/komsco-checker`이며 `main` 푸시가 Vercel의 운영 배포를 시작합니다. 비밀값 파일, `.env.local`, `.secrets/`는 절대 `git add` 하지 않습니다.

### Vercel 운영 배포 확인

1. Vercel Dashboard에서 Production 배포가 `Ready`인지 확인합니다.
2. `https://komsco-checker.vercel.app`을 열어 버전과 화면이 바뀌었는지 확인합니다.
3. 읽기 전용 상태 확인: `https://komsco-checker.vercel.app/api/health`
4. 응답의 `storage.connected`, `alerting.cronConfigured`, `alerting.telegramConfigured`, `monitor.control.enabled`를 확인합니다.
5. GitHub Actions → **Service monitoring**의 최신 실행이 성공했는지 확인합니다.

운영 API에 수동 점검 요청을 반복해서 보내지 않습니다. 즉시 점검은 대시보드의 `지금 점검`을 한 번만 사용하고, 결과 확인은 `GET /api/health`로 합니다.

## 일상 운영

### 대시보드 조회

대시보드의 `자동 조회`는 화면 갱신 주기만 조절합니다. 이 값은 현재 브라우저의 `localStorage`에 저장되며 서버 스케줄을 바꾸지 않습니다. 탭을 닫으면 화면 자동 조회만 멈추고, GitHub Actions의 5분 점검은 계속됩니다.

### 전체 모니터링 일시정지/재개

점검 대상 서비스에 과도한 요청이 우려되거나 장애를 조사할 때 사용합니다.

1. 대시보드의 `관리자 비밀키` 칸에 `DASHBOARD_CONTROL_SECRET`을 입력합니다.
2. `모니터링 일시정지`를 누릅니다.
3. 상태가 `일시정지`로 바뀌고 최근 제어 이력에 기록됐는지 확인합니다.
4. 조치가 끝나면 같은 비밀키로 `모니터링 재개`를 누릅니다.

일시정지는 저장소에 기록되므로 Redis가 연결돼 있으면 배포·브라우저 종료 뒤에도 유지됩니다. 정지 중에는 GitHub 스케줄과 대시보드의 수동 점검 모두 새 사이트 요청을 보내지 않습니다. 관리자 비밀키는 브라우저 탭의 `sessionStorage`에만 보관되며, 탭을 닫으면 사라집니다.

## 장애 대응

| 증상 | 즉시 조치 | 원인 확인 |
| --- | --- | --- |
| 대상 사이트가 연속 실패 | 대시보드 상태·HTTP 코드 확인, 실제 서비스 담당자에게 전달 | DNS, 인증, 대상 서버 장애, 응답 지연 확인 |
| 요청량 또는 CPU가 급증 | 즉시 전체 모니터링 일시정지 | GitHub Actions 재시도, 수동 점검 반복, 외부 호출 로그 확인 |
| `failed to fetch` | 대시보드 새로고침 후 `/api/health` 응답 확인 | Vercel Function 로그, 네트워크, 브라우저 확장 기능 확인 |
| 이력이 자꾸 초기화됨 | Upstash Redis 환경 변수 설정 후 재배포 | API의 `storage.connected`가 `true`인지 확인 |
| 스케줄 점검이 실행되지 않음 | GitHub Actions 최신 실행과 `CRON_SECRET` 확인 | GitHub Secret과 Vercel Production 값의 불일치 확인 |
| Telegram이 오지 않음 | 설정 상태와 봇/채팅 권한 확인 | 토큰, Chat ID, 임계치, Vercel Function 로그 확인 |

관리자 비밀키나 CRON 비밀키가 노출됐다고 판단되면 Vercel과 GitHub Actions Secret의 값을 모두 새 값으로 교체하고 즉시 재배포합니다.

## 운영 상태 판정 기준

정상 운영은 아래 네 가지를 모두 만족하는 상태입니다.

- Production 배포가 `Ready`이고 대시보드가 열림
- GitHub Actions의 최근 스케줄 실행이 성공
- API에서 `monitor.control.enabled: true`
- API에서 `storage.connected: true` 및 필요 시 `alerting.telegramConfigured: true`

현재 Upstash 또는 Telegram을 아직 설정하지 않았다면 서비스는 화면·스케줄 점검까지는 가능하지만, 운영 이력의 지속성 또는 외부 알림은 완성되지 않은 상태입니다. 해당 자격증명을 Vercel에 등록한 뒤 이 판정 기준을 다시 확인합니다.
