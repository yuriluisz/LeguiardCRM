import { createClient } from "@/lib/supabase/server";
import type { FollowConfig } from "@/types/database";

const FOLLOWUP_SETTINGS_TTL_MS = 20_000;

type FollowupSettings = {
  followStatus: boolean;
  followConfig: FollowConfig | null;
};

type FollowupSettingsCacheEntry = {
  value: FollowupSettings;
  expiresAt: number;
};

const followupSettingsCache = new Map<string, FollowupSettingsCacheEntry>();

function clearExpiredFollowupSettingsCache(now: number) {
  for (const [key, entry] of followupSettingsCache) {
    if (entry.expiresAt <= now) {
      followupSettingsCache.delete(key);
    }
  }
}

export async function getTenantFollowupSettingsCached(
  tenantId: string
): Promise<FollowupSettings> {
  const now = Date.now();
  clearExpiredFollowupSettingsCache(now);

  const cached = followupSettingsCache.get(tenantId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("follow_status, follow_config")
    .eq("id", tenantId)
    .maybeSingle();

  const value: FollowupSettings = {
    followStatus: Boolean(data?.follow_status),
    followConfig: (data?.follow_config as FollowConfig | null) || null,
  };

  followupSettingsCache.set(tenantId, {
    value,
    expiresAt: now + FOLLOWUP_SETTINGS_TTL_MS,
  });

  return value;
}
