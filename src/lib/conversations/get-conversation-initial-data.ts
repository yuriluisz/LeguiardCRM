import { createClient } from "@/lib/supabase/server";
import type { CrmConfig, Interaction, Lead } from "@/types/database";

const CONVERSATION_SEED_TTL_MS = 15_000;

type ConversationSeedCacheEntry = {
  value: ConversationInitialData;
  expiresAt: number;
};

const conversationSeedCache = new Map<string, ConversationSeedCacheEntry>();

function clearExpiredConversationSeedCache(now: number) {
  for (const [key, entry] of conversationSeedCache) {
    if (entry.expiresAt <= now) {
      conversationSeedCache.delete(key);
    }
  }
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ConversationInitialData = {
  selectedLead: Lead | null;
  interactions: Interaction[];
  crmConfig: CrmConfig | null;
};

export async function getConversationInitialData(
  supabase: SupabaseServerClient,
  tenantId: string,
  leadId: string | null
): Promise<ConversationInitialData> {
  if (!leadId) {
    return { selectedLead: null, interactions: [], crmConfig: null };
  }

  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id,tenant_id,phone,name,email,status_kanban,temperature,ai_active,not_a_lead,last_interaction,created_at,ai_run_count,conv_id,follow_stage,custom_data,ai_summary,history_sync_needed"
    )
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!lead) {
    return { selectedLead: null, interactions: [], crmConfig: null };
  }

  const normalizedLead: Lead = {
    ...(lead as Lead),
    status_kanban: lead.status_kanban
      ? String(lead.status_kanban).toLowerCase()
      : lead.status_kanban,
  };

  const [{ data: interactions }, { data: tenant }] = await Promise.all([
    supabase
      .from("interactions")
      .select("id,lead_id,role,content,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tenants")
      .select("crm_config")
      .eq("id", tenantId)
      .maybeSingle(),
  ]);

  return {
    selectedLead: normalizedLead,
    interactions: (interactions as Interaction[] | null) || [],
    crmConfig: (tenant?.crm_config as CrmConfig | null) || null,
  };
}

export async function getConversationInitialDataCached(
  tenantId: string,
  leadId: string | null
): Promise<ConversationInitialData> {
  const cacheKey = `${tenantId}:${leadId || "none"}`;
  const now = Date.now();
  clearExpiredConversationSeedCache(now);

  const cached = conversationSeedCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const supabase = await createClient();
  const value = await getConversationInitialData(supabase, tenantId, leadId);
  conversationSeedCache.set(cacheKey, {
    value,
    expiresAt: now + CONVERSATION_SEED_TTL_MS,
  });

  return value;
}
