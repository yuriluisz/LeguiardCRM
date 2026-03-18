import { DEMO_MODE_COOKIE, DEMO_MODE_SESSION_KEY } from "@/lib/demo/constants";

type CookieStoreLike = {
  get: (name: string) => { value: string } | undefined;
};

function isTruthy(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

function readCookieFromDocument(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const token = `${name}=`;
  const parts = document.cookie.split(";");

  for (const part of parts) {
    const cookie = part.trim();
    if (cookie.startsWith(token)) {
      return decodeURIComponent(cookie.slice(token.length));
    }
  }

  return null;
}

export function isDemoModeEnabledOnClient(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const sessionValue = window.sessionStorage.getItem(DEMO_MODE_SESSION_KEY);
  if (sessionValue !== null) {
    return isTruthy(sessionValue);
  }

  return isTruthy(readCookieFromDocument(DEMO_MODE_COOKIE));
}

export function setDemoModeInClient(enabled: boolean): void {
  if (typeof document !== "undefined") {
    if (enabled) {
      document.cookie = `${DEMO_MODE_COOKIE}=1; path=/; samesite=lax`;
    } else {
      document.cookie = `${DEMO_MODE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    }
  }

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(DEMO_MODE_SESSION_KEY, enabled ? "1" : "0");
  }
}

export function isDemoModeEnabledForRequestCookie(value: string | null | undefined): boolean {
  return isTruthy(value);
}

export function isDemoModeEnabledFromCookieStore(cookieStore: CookieStoreLike): boolean {
  return isDemoModeEnabledForRequestCookie(cookieStore.get(DEMO_MODE_COOKIE)?.value);
}
