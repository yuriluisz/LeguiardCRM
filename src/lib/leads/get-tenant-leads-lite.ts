import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/database";

const TENANT_LEADS_TTL_MS = 20_000;

type TenantLeadsCacheEntry = {
  value: Lead[];
  expiresAt: number;
};

const tenantLeadsCache = new Map<string, TenantLeadsCacheEntry>();

function clearExpiredTenantLeadsCache(now: number) {
  for (const [key, entry] of tenantLeadsCache) {
    if (entry.expiresAt <= now) {
      tenantLeadsCache.delete(key);
    }
  }
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getTenantLeadsLite(
  supabase: SupabaseServerClient,
  tenantId: string,
  limit = 300
): Promise<Lead[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 300);

  const { data } = await supabase
    .from("leads")
    .select(
      "id,tenant_id,phone,name,email,status_kanban,temperature,ai_active,not_a_lead,last_interaction,created_at,ai_run_count,conv_id,follow_stage"
    )
    .eq("tenant_id", tenantId)
    .order("last_interaction", { ascending: false, nullsFirst: false })
    .range(0, safeLimit - 1);

  const leads = (data as Lead[] | null) || [];

  return leads.map((lead) => ({
    ...lead,
    custom_data: lead.custom_data ?? null,
    ai_summary: lead.ai_summary ?? null,
    history_sync_needed: lead.history_sync_needed ?? false,
    status_kanban: lead.status_kanban
      ? String(lead.status_kanban).toLowerCase()
      : lead.status_kanban,
  }));
}

export async function getTenantLeadsLiteCached(
  tenantId: string,
  limit = 300
): Promise<Lead[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 300);
  const cacheKey = `${tenantId}:${safeLimit}`;
  const now = Date.now();
  clearExpiredTenantLeadsCache(now);

  const cached = tenantLeadsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const supabase = await createClient();
  const value = await getTenantLeadsLite(supabase, tenantId, safeLimit);
  tenantLeadsCache.set(cacheKey, {
    value,
    expiresAt: now + TENANT_LEADS_TTL_MS,
  });

  return value;
}
