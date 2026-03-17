import { createClient } from "@/lib/supabase/server";
import type { CrmConfig, Interaction, Lead } from "@/types/database";

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
    .select("*")
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
      .select("*")
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
