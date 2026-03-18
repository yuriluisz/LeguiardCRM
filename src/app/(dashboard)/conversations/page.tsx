import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { CrmConfig, Interaction, Lead } from "@/types/database";
import ConversationsClient from "./conversations-client";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";
import { getTenantLeadsLiteCached } from "@/lib/leads/get-tenant-leads-lite";
import { getConversationInitialDataCached } from "@/lib/conversations/get-conversation-initial-data";
import { isDemoModeEnabledFromCookieStore } from "@/lib/demo/demo-mode";
import { getDemoLeadDetailPayload, getDemoLeads } from "@/lib/demo/demo-data";

type ConversationsPageProps = {
  searchParams: Promise<{ lead?: string }>;
};

export default async function ConversationsPage({
  searchParams,
}: ConversationsPageProps) {
  const { user, selectedTenantId, tenants } = await getAccessibleTenantsServer();
  const params = await searchParams;
  const cookieStore = await cookies();
  const demoMode = isDemoModeEnabledFromCookieStore(cookieStore);

  if (!user) {
    redirect("/login");
  }

  if (!selectedTenantId) {
    return (
      <ConversationsClient
        initialTenantId={null}
        initialLeads={[]}
        initialSelectedLead={null}
        initialInteractions={[]}
        initialCrmConfig={null}
      />
    );
  }

  if (demoMode) {
    const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? null;
    const initialLeads = getDemoLeads({
      tenantId: selectedTenantId,
      tenantName: selectedTenant?.name ?? undefined,
      kanbanColumns: selectedTenant?.kanban_config?.columns,
    });
    const details = params.lead
      ? getDemoLeadDetailPayload(params.lead, {
          tenantId: selectedTenantId,
          tenantName: selectedTenant?.name ?? undefined,
          kanbanColumns: selectedTenant?.kanban_config?.columns,
        })
      : { lead: null, interactions: [], crmConfig: null };

    return (
      <ConversationsClient
        initialTenantId={selectedTenantId}
        initialLeads={initialLeads}
        initialSelectedLead={(details.lead as Lead | null) ?? null}
        initialInteractions={(details.interactions as Interaction[]) ?? []}
        initialCrmConfig={(details.crmConfig as CrmConfig | null) ?? null}
      />
    );
  }

  const [initialLeads, conversationSeed] = await Promise.all([
    getTenantLeadsLiteCached(selectedTenantId, 120),
    getConversationInitialDataCached(selectedTenantId, params.lead || null),
  ]);

  return (
    <ConversationsClient
      initialTenantId={selectedTenantId}
      initialLeads={initialLeads}
      initialSelectedLead={(conversationSeed.selectedLead as Lead | null) ?? null}
      initialInteractions={(conversationSeed.interactions as Interaction[]) ?? []}
      initialCrmConfig={(conversationSeed.crmConfig as CrmConfig | null) ?? null}
    />
  );
}
