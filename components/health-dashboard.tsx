"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type {
  AlertEvent,
  DashboardPayload,
  HealthResult,
  HourlyAggregate,
  MonitoringControlEvent,
  RawHistorySample,
  SiteConfig
} from "@/lib/types";

const APP_VERSION = "v1.3.0";
const SETTINGS_KEY = "komsco-next-pulseboard/settings";
const CONTROL_SECRET_KEY = "komsco-next-pulseboard/control-secret";

type Settings = {
  intervalMs: number;
  timeoutMs: number;
  autoRefresh: boolean;
  soundEnabled: boolean;
};

type Notification = {
  id: string;
  tone: "danger" | "success";
  title: string;
  message: string;
};

type SiteRow = {
  site: SiteConfig;
  latest: HealthResult | null;
  rawSamples: RawHistorySample[];
  hourly: HourlyAggregate[];
  recentUptime: number | null;
  archiveUptime: number | null;
  archiveLatency: number | null;
  failureStreak: number;
  spark: {
    line: string;
    area: string;
    dots: Array<{ x: number; y: number }>;
  };
};

const defaultSettings: Settings = {
  intervalMs: 300000,
  timeoutMs: 8000,
  autoRefresh: true,
  soundEnabled: true
};

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? ({ ...defaultSettings, ...JSON.parse(raw) } as Settings) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function saveSettings(settings: Settings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadControlSecret() {
  try {
    return window.sessionStorage.getItem(CONTROL_SECRET_KEY) || "";
  } catch {
    return "";
  }
}

function saveControlSecret(value: string) {
  try {
    window.sessionStorage.setItem(CONTROL_SECRET_KEY, value);
  } catch {
    // session storage may be unavailable in hardened browser modes.
  }
}

function formatTime(value: string | number | null) {
  if (!value) {
    return "미실행";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function formatLatency(value: number | null) {
  return Number.isFinite(value) ? `${Math.round(value as number)} ms` : "-";
}

function formatPercent(value: number | null) {
  return Number.isFinite(value) ? `${Math.round(value as number)}%` : "-";
}

function formatCountdown(ms: number | null) {
  if (!Number.isFinite(ms) || ms === null) {
    return "멈춤";
  }

  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

function buildSpark(samples: RawHistorySample[]) {
  if (!samples.length) {
    return { line: "", area: "", dots: [] as Array<{ x: number; y: number }> };
  }

  const width = 240;
  const baseline = 54;
  const step = samples.length > 1 ? width / (samples.length - 1) : width;
  const latencies = samples
    .map((sample) => sample.latencyMs)
    .filter((value): value is number => Number.isFinite(value));
  const maxLatency = latencies.length ? Math.max(...latencies, 800) : 800;
  const points = samples.map((sample, index) => {
    const x = step * index;
    const y = sample.state === "down"
      ? baseline
      : 18 + ((Math.min(sample.latencyMs || maxLatency, maxLatency) / maxLatency) * 24);
    return { x, y, down: sample.state === "down" };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

  return {
    line: path,
    area: `${path} L 240 54 L 0 54 Z`,
    dots: points.filter((point) => point.down).map(({ x, y }) => ({ x, y }))
  };
}

function buildRows(initialSites: SiteConfig[], dashboard: DashboardPayload | null, query: string): SiteRow[] {
  const monitor = dashboard?.monitor;
  const keyword = query.trim().toLowerCase();
  const sites = keyword
    ? initialSites.filter((site) => [site.id, site.name, site.url].some((value) => value.toLowerCase().includes(keyword)))
    : initialSites;
  const latestMap = new Map<string, HealthResult>(
    (monitor?.latest?.results || []).map((result) => [result.id, result])
  );

  return sites.map((site) => {
    const rawSamples: RawHistorySample[] = monitor?.rawHistoryBySite[site.id] || [];
    const hourly: HourlyAggregate[] = monitor?.hourlyHistoryBySite[site.id] || [];
    const latest = latestMap.get(site.id) || null;
    const recentUp = rawSamples.filter((sample) => sample.state === "up").length;
    const recentUptime = rawSamples.length ? Math.round((recentUp / rawSamples.length) * 100) : null;
    const hourlyTotal = hourly.reduce((sum, bucket) => sum + bucket.total, 0);
    const hourlyUp = hourly.reduce((sum, bucket) => sum + bucket.up, 0);
    const hourlyLatencySum = hourly.reduce((sum, bucket) => sum + bucket.latencySum, 0);
    const hourlyLatencySamples = hourly.reduce((sum, bucket) => sum + bucket.latencySamples, 0);
    let failureStreak = 0;

    for (let index = rawSamples.length - 1; index >= 0; index -= 1) {
      if (rawSamples[index].state === "down") {
        failureStreak += 1;
      } else {
        break;
      }
    }

    return {
      site,
      latest,
      rawSamples,
      hourly,
      recentUptime,
      archiveUptime: hourlyTotal ? Math.round((hourlyUp / hourlyTotal) * 100) : null,
      archiveLatency: hourlyLatencySamples ? Math.round(hourlyLatencySum / hourlyLatencySamples) : null,
      failureStreak,
      spark: buildSpark(rawSamples.slice(-24))
    };
  });
}

function playWarningTone() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Browsers can block audio until the user has interacted with the page.
  }
}

export function HealthDashboard({ initialSites }: { initialSites: SiteConfig[] }) {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [controlLoading, setControlLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextRunAt, setNextRunAt] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [controlSecret, setControlSecret] = useState("");
  const previousStatesRef = useRef<Map<string, HealthResult["state"]>>(new Map());
  const lastErrorRef = useRef<string | null>(null);
  const notificationSequenceRef = useRef(0);

  const dismissNotification = useEffectEvent((id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  });

  const showNotification = useEffectEvent((notification: Omit<Notification, "id">, playSound = false) => {
    notificationSequenceRef.current += 1;
    const id = `${Date.now()}-${notificationSequenceRef.current}`;
    setNotifications((current) => [{ ...notification, id }, ...current].slice(0, 4));
    window.setTimeout(() => dismissNotification(id), 9000);

    if (playSound && settings.soundEnabled) {
      playWarningTone();
    }
  });

  const applyDashboard = useEffectEvent((payload: DashboardPayload) => {
    const currentStates = new Map(payload.monitor.latest?.results.map((result) => [result.id, result.state]) || []);
    const hasPreviousSnapshot = previousStatesRef.current.size > 0;

    if (hasPreviousSnapshot) {
      payload.monitor.latest?.results.forEach((result) => {
        const previousState = previousStatesRef.current.get(result.id);
        if (previousState !== "down" && result.state === "down") {
          showNotification({
            tone: "danger",
            title: "사이트 장애 감지",
            message: `${result.name}: ${result.statusCode ? `HTTP ${result.statusCode}` : result.detail}`
          }, true);
        }

        if (previousState === "down" && result.state === "up") {
          showNotification({
            tone: "success",
            title: "사이트 복구",
            message: `${result.name}이(가) 정상 응답으로 복구되었습니다.`
          });
        }
      });
    }

    previousStatesRef.current = currentStates;
    lastErrorRef.current = null;
    setDashboard(payload);
    setError(null);
  });

  const showRequestError = useEffectEvent((nextError: unknown) => {
    const message = nextError instanceof Error ? nextError.message : "알 수 없는 오류";
    setError(message);

    if (lastErrorRef.current !== message) {
      showNotification({
        tone: "danger",
        title: "점검 연결 오류",
        message
      }, true);
      lastErrorRef.current = message;
    }
  });

  useEffect(() => {
    setSettings(loadSettings());
    setControlSecret(loadControlSecret());
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveControlSecret(controlSecret);
  }, [controlSecret]);

  const fetchDashboard = useEffectEvent(async () => {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`대시보드 조회 실패 (${response.status})`);
      }
      const payload = (await response.json()) as DashboardPayload;
      applyDashboard(payload);
    } catch (nextError) {
      showRequestError(nextError);
    }
  });

  const runManualCheck = useEffectEvent(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/health?timeout=${settings.timeoutMs}`, {
        method: "POST",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`점검 실행 실패 (${response.status})`);
      }

      const payload = (await response.json()) as DashboardPayload & { operation?: { message?: string } };
      applyDashboard(payload);
      if (payload.operation?.message) {
        showNotification({
          tone: payload.monitor.control.enabled ? "success" : "danger",
          title: "점검 결과",
          message: payload.operation.message
        }, false);
      }
      setNextRunAt(Date.now() + settings.intervalMs);
    } catch (nextError) {
      showRequestError(nextError);
    } finally {
      setLoading(false);
    }
  });

  const applyControlState = useEffectEvent(async (enabled: boolean) => {
    if (!controlSecret.trim()) {
      showNotification({
        tone: "danger",
        title: "관리자 비밀키 필요",
        message: "일시정지/재개를 하려면 관리자 비밀키를 먼저 입력해야 합니다."
      }, true);
      return;
    }

    setControlLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/control", {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-dashboard-control-secret": controlSecret.trim()
        },
        body: JSON.stringify({ enabled })
      });

      if (!response.ok) {
        throw new Error(`제어 실행 실패 (${response.status})`);
      }

      const payload = (await response.json()) as DashboardPayload & { operation?: { message?: string } };
      applyDashboard(payload);
      if (payload.operation?.message) {
        showNotification({
          tone: enabled ? "success" : "danger",
          title: enabled ? "모니터링 재개" : "모니터링 일시정지",
          message: payload.operation.message
        }, !enabled);
      }
    } catch (nextError) {
      showRequestError(nextError);
    } finally {
      setControlLoading(false);
    }
  });

  useEffect(() => {
    void fetchDashboard();
  }, []);

  useEffect(() => {
    if (!settings.autoRefresh) {
      setNextRunAt(null);
      return;
    }

    void fetchDashboard();
    setNextRunAt(Date.now() + settings.intervalMs);
    const intervalId = window.setInterval(() => {
      void fetchDashboard();
      setNextRunAt(Date.now() + settings.intervalMs);
    }, settings.intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [settings.autoRefresh, settings.intervalMs]);

  useEffect(() => {
    if (!settings.autoRefresh) {
      return;
    }

    const timerId = window.setInterval(() => {
      setNextRunAt((current) => current);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [settings.autoRefresh]);

  const rows = buildRows(initialSites, dashboard, query);
  const downRows = rows.filter((row) => row.latest?.state === "down");
  const latest = dashboard?.monitor.latest;
  const latestResults: HealthResult[] = latest?.results || [];
  const upCount = latest?.summary.up || 0;
  const downCount = latest?.summary.down || 0;
  const rawHistoryBySite: Record<string, RawHistorySample[]> = dashboard?.monitor.rawHistoryBySite || {};
  const hourlyHistoryBySite: Record<string, HourlyAggregate[]> = dashboard?.monitor.hourlyHistoryBySite || {};
  const recentAlerts: AlertEvent[] = dashboard?.monitor.recentAlerts || [];
  const controlHistory: MonitoringControlEvent[] = dashboard?.monitor.controlHistory || [];
  const rawCount = Object.values(rawHistoryBySite).reduce((sum, samples) => sum + samples.length, 0);
  const archiveCount = Object.values(hourlyHistoryBySite).reduce((sum, buckets) => sum + buckets.length, 0);
  const allBuckets: HourlyAggregate[] = Object.values(hourlyHistoryBySite).flat();
  const archiveTotal = allBuckets.reduce((sum, bucket) => sum + bucket.total, 0);
  const archiveUp = allBuckets.reduce((sum, bucket) => sum + bucket.up, 0);
  const monitoringEnabled = dashboard?.monitor.control.enabled ?? true;

  return (
    <main className="page-shell">
      <div className="toast-region" aria-live="assertive" aria-atomic="false">
        {notifications.map((notification) => (
          <div className={`toast toast-${notification.tone}`} key={notification.id} role="alert">
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.message}</p>
            </div>
            <button type="button" aria-label="알림 닫기" onClick={() => dismissNotification(notification.id)}>×</button>
          </div>
        ))}
      </div>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">SERVICE STATUS MONITOR</span>
          <h1>고객사이트 서비스 모니터링</h1>
          <p>
            등록된 고객사이트의 접속 상태와 응답 속도를 정기적으로 확인합니다.
            장애가 감지되면 화면 경고와 경고음, 텔레그램으로 즉시 알려드립니다.
          </p>
        </div>
        <div className="hero-grid">
          <div className="hero-stat">
            <span>배포 버전</span>
            <strong>{APP_VERSION}</strong>
          </div>
          <div className="hero-stat">
            <span>최근 점검</span>
            <strong>{formatTime(dashboard?.monitor.updatedAt ?? null)}</strong>
          </div>
          <div className="hero-stat">
            <span>모니터링 주기</span>
            <strong>{dashboard ? `${dashboard.alerting.monitorIntervalMinutes}분` : "5분"}</strong>
          </div>
          <div className="hero-stat">
            <span>전체 상태</span>
            <strong>{monitoringEnabled ? "실행 중" : "일시정지"}</strong>
          </div>
        </div>
      </section>

      <section className="sticky-bar">
        <div className="sticky-metric">
          <span>정상</span>
          <strong>{upCount}</strong>
        </div>
        <div className="sticky-metric">
          <span>장애</span>
          <strong>{downCount}</strong>
        </div>
        <div className="sticky-metric">
          <span>검색 결과</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="sticky-metric">
          <span>다음 조회</span>
          <strong>{settings.autoRefresh ? formatCountdown(nextRunAt ? nextRunAt - Date.now() : null) : "멈춤"}</strong>
        </div>
      </section>

      <section className="toolbar-panel">
        <label className="search-field">
          <span>검색</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사이트 이름, id, URL" />
        </label>

        <label className="select-field">
          <span>조회 주기</span>
          <select value={settings.intervalMs} onChange={(event) => setSettings((previous) => ({ ...previous, intervalMs: Number(event.target.value) }))}>
            <option value={60000}>1분</option>
            <option value={180000}>3분</option>
            <option value={300000}>5분</option>
            <option value={600000}>10분</option>
          </select>
        </label>

        <label className="select-field">
          <span>체크 타임아웃</span>
          <select value={settings.timeoutMs} onChange={(event) => setSettings((previous) => ({ ...previous, timeoutMs: Number(event.target.value) }))}>
            <option value={4000}>4초</option>
            <option value={8000}>8초</option>
            <option value={12000}>12초</option>
            <option value={16000}>16초</option>
          </select>
        </label>

        <button className="primary-button" type="button" onClick={() => void runManualCheck()} disabled={loading || !monitoringEnabled}>
          {loading ? "점검 중..." : monitoringEnabled ? "지금 점검" : "일시정지 중"}
        </button>

        <button className="secondary-button" type="button" onClick={() => setSettings((previous) => ({ ...previous, autoRefresh: !previous.autoRefresh }))}>
          {settings.autoRefresh ? "자동 조회 멈춤" : "자동 조회 시작"}
        </button>
        <button
          className="secondary-button"
          type="button"
          aria-pressed={settings.soundEnabled}
          onClick={() => setSettings((previous) => ({ ...previous, soundEnabled: !previous.soundEnabled }))}
        >
          {settings.soundEnabled ? "경고음 켬" : "경고음 끔"}
        </button>
      </section>

      <section className="toolbar-panel admin-panel">
        <label className="search-field">
          <span>관리자 비밀키</span>
          <input
            type="password"
            value={controlSecret}
            onChange={(event) => setControlSecret(event.target.value)}
            placeholder="DASHBOARD_CONTROL_SECRET 입력"
          />
        </label>
        <button className="primary-button" type="button" onClick={() => void applyControlState(true)} disabled={controlLoading || monitoringEnabled}>
          {controlLoading ? "처리 중..." : "모니터링 재개"}
        </button>
        <button className="secondary-button" type="button" onClick={() => void applyControlState(false)} disabled={controlLoading || !monitoringEnabled}>
          {controlLoading ? "처리 중..." : "모니터링 일시정지"}
        </button>
        <div className="registry-item compact-state">
          <strong>현재 상태</strong>
          <span>{monitoringEnabled ? "실행 중" : "일시정지"}</span>
          <code>
            {dashboard?.monitor.control.updatedAt ? `${formatTime(dashboard.monitor.control.updatedAt)} · ${dashboard.monitor.control.updatedBy ?? "-"}` : "아직 변경 이력 없음"}
          </code>
        </div>
      </section>

      {downRows.length ? (
        <section className="incident-banner" role="alert">
          <strong>장애 경고 · {downRows.length}개 사이트 점검 실패</strong>
          <span>{downRows.map((row) => row.site.name).join(", ")}</span>
        </section>
      ) : null}
      {error ? <p className="status-banner danger">{error}</p> : null}
      <p className="status-banner">
        자동 모니터링 결과는 {dashboard?.alerting.monitorIntervalMinutes ?? 5}분마다 갱신됩니다.
        장애 알림은 {dashboard?.alerting.failureThreshold ?? 1}회 실패 시 발송되며, 복구 상태도 함께 안내합니다.
        {monitoringEnabled ? " 현재 전체 모니터링은 실행 중입니다." : " 현재 전체 모니터링은 일시정지되어 있습니다."}
      </p>

      <section className="summary-grid">
        <article className="summary-card">
          <span>현재 가용 비율</span>
          <strong>{latestResults.length ? formatPercent((upCount / latestResults.length) * 100) : "-"}</strong>
        </article>
        <article className="summary-card">
          <span>30일 집계 정상률</span>
          <strong>{archiveTotal ? formatPercent((archiveUp / archiveTotal) * 100) : "-"}</strong>
        </article>
        <article className="summary-card">
          <span>원본 샘플 수</span>
          <strong>{rawCount}개</strong>
        </article>
        <article className="summary-card">
          <span>시간 집계 수</span>
          <strong>{archiveCount}칸</strong>
        </article>
      </section>

      <section className="content-grid">
        <div className="cards-grid">
          {rows.map((row) => (
            <article className="site-card" key={row.site.id}>
              <div className="site-head">
                <div>
                  <h2>{row.site.name}</h2>
                  <p>{row.site.url}</p>
                </div>
                <span className={`status-pill ${row.latest?.state ?? "idle"}`}>
                  {row.latest?.state === "up" ? "정상" : row.latest?.state === "down" ? "장애" : "대기"}
                </span>
              </div>

              <div className="meta-row">
                <span>{row.site.id}</span>
                <span>{row.latest?.statusCode ? `HTTP ${row.latest.statusCode}` : row.latest?.detail === "timeout" ? "타임아웃" : "미점검"}</span>
                <span>30일 {formatPercent(row.archiveUptime)}</span>
              </div>

              <div className="metric-row">
                <div className="metric-box">
                  <span>마지막 응답</span>
                  <strong>{formatLatency(row.latest?.latencyMs ?? null)}</strong>
                </div>
                <div className="metric-box">
                  <span>최근 정상률</span>
                  <strong>{formatPercent(row.recentUptime)}</strong>
                </div>
                <div className="metric-box">
                  <span>연속 실패</span>
                  <strong>{row.failureStreak}회</strong>
                </div>
              </div>

              <div className="spark-panel">
                <div className="spark-head">
                  <span>최근 {Math.min(row.rawSamples.length, 24)}회 추세</span>
                  <span>{formatTime(row.latest?.checkedAt ?? null)}</span>
                </div>
                <svg viewBox="0 0 240 64" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="0" y1="54" x2="240" y2="54" className="spark-axis" />
                  {row.spark.area ? <path d={row.spark.area} className="spark-area" /> : null}
                  {row.spark.line ? <path d={row.spark.line} className="spark-line" /> : null}
                  {row.spark.dots.map((dot, index) => (
                    <circle key={`${row.site.id}-${index}`} cx={dot.x} cy={dot.y} r="2.8" className="spark-dot" />
                  ))}
                </svg>
              </div>

              <div className="archive-strip">
                <div>
                  <span>시간 집계</span>
                  <strong>{row.hourly.length}칸</strong>
                </div>
                <div>
                  <span>누적 점검</span>
                  <strong>{row.hourly.reduce((sum, bucket) => sum + bucket.total, 0)}회</strong>
                </div>
                <div>
                  <span>집계 평균</span>
                  <strong>{formatLatency(row.archiveLatency)}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="side-stack">
          <section className="side-panel">
            <h2>서비스 운영 상태</h2>
            <div className="registry-list">
              <div className="registry-item">
                <strong>점검 이력 저장</strong>
                <span>{dashboard?.storage.connected ? "정상" : "임시 저장 모드"}</span>
                <code>{dashboard?.storage.connected ? "운영 데이터 저장 중" : "영구 저장소 연결 필요"}</code>
              </div>
              <div className="registry-item">
                <strong>자동 모니터링</strong>
                <span>{dashboard?.alerting.cronConfigured ? "활성" : "설정 필요"}</span>
                <code>{dashboard?.alerting.monitorIntervalMinutes ?? 5}분 간격</code>
              </div>
              <div className="registry-item">
                <strong>관리자 제어</strong>
                <span>{dashboard?.monitor.control.enabled ? "실행 중" : "일시정지"}</span>
                <code>{dashboard?.monitor.control.updatedAt ? `${formatTime(dashboard.monitor.control.updatedAt)} · ${dashboard.monitor.control.updatedBy ?? "-"}` : "변경 이력 없음"}</code>
              </div>
            </div>
          </section>

          <section className="side-panel">
            <h2>최근 제어 이력</h2>
            <div className="registry-list">
              {controlHistory.slice(0, 8).map((event) => (
                <div className="registry-item" key={event.id}>
                  <strong>{event.type === "paused" ? "일시정지" : "재개"}</strong>
                  <span>{event.source}</span>
                  <code>{formatTime(event.at)} · {event.message}</code>
                </div>
              ))}
              {controlHistory.length ? null : (
                <div className="registry-item">
                  <strong>제어 이력 없음</strong>
                  <span>아직 모니터링을 멈추거나 재개한 적이 없습니다.</span>
                  <code>관리자 비밀키를 입력하면 이력이 여기에 쌓입니다.</code>
                </div>
              )}
            </div>
          </section>

          <section className="side-panel">
            <h2>최근 이벤트 알림</h2>
            <div className="registry-list">
              {recentAlerts.slice(0, 8).map((alert) => (
                <div className="registry-item" key={alert.id}>
                  <strong>{alert.siteName}</strong>
                  <span>
                    {alert.type === "down"
                      ? "장애 감지"
                      : alert.type === "failure-threshold"
                        ? `${alert.failureCount ?? 3}회 연속 실패`
                        : "복구 감지"}
                  </span>
                  <code>{formatTime(alert.checkedAt)} · {alert.message}</code>
                </div>
              ))}
              {recentAlerts.length ? null : (
                <div className="registry-item">
                  <strong>이벤트 없음</strong>
                  <span>아직 장애 또는 복구 이벤트가 없습니다.</span>
                  <code>크론 실행 후 상태 변화가 생기면 여기에 누적됩니다.</code>
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}