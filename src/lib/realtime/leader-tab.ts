type LeaderRecord = {
  tabId: string;
  ts: number;
};

function safeParse(value: string | null): LeaderRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as LeaderRecord;
    if (!parsed?.tabId || typeof parsed.ts !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createLeaderTabCoordinator(scope: string, ttlMs = 20_000) {
  const storageKey = `leader-tab:${scope}`;
  const tabId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function read(): LeaderRecord | null {
    if (typeof window === "undefined") return null;
    return safeParse(window.localStorage.getItem(storageKey));
  }

  function write() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ tabId, ts: Date.now() } satisfies LeaderRecord)
    );
  }

  function isStale(record: LeaderRecord) {
    return Date.now() - record.ts > ttlMs;
  }

  function shouldRun(): boolean {
    const current = read();

    if (!current || isStale(current) || current.tabId === tabId) {
      write();
      return true;
    }

    return false;
  }

  function release() {
    const current = read();
    if (!current) return;
    if (current.tabId === tabId && typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
  }

  return {
    shouldRun,
    release,
  };
}