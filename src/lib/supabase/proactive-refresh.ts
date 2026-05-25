import { createClient } from "@/lib/supabase/client";

const MIN_WARMUP_INTERVAL_MS = 60_000;

let lastWarmupAt = 0;
let warmupInFlight: Promise<void> | null = null;

export async function warmupSupabaseSession() {
  const now = Date.now();
  if (warmupInFlight) {
    return warmupInFlight;
  }

  if (now - lastWarmupAt < MIN_WARMUP_INTERVAL_MS) {
    return;
  }

  warmupInFlight = (async () => {
    const supabase = createClient();

    try {
      await supabase.auth.getUser();
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Falha ao aquecer sessao Supabase:", error);
      }
    } finally {
      lastWarmupAt = Date.now();
    }
  })();

  try {
    await warmupInFlight;
  } finally {
    warmupInFlight = null;
  }
}
