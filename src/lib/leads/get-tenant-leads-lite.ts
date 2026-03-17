import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/database";

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
      "id,tenant_id,phone,name,email,status_kanban,temperature,ai_active,not_a_lead,last_interaction,created_at,ai_run_count,conv_id,follow_stage,custom_data,ai_summary"
    )
    .eq("tenant_id", tenantId)
    .order("last_interaction", { ascending: false, nullsFirst: false })
    .range(0, safeLimit - 1);

  const leads = (data as Lead[] | null) || [];

  return leads.map((lead) => ({
    ...lead,
    status_kanban: lead.status_kanban
      ? String(lead.status_kanban).toLowerCase()
      : lead.status_kanban,
  }));
}
