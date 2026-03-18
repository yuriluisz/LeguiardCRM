import { redirect } from "next/navigation";
import type { CrmConfig, Interaction, Lead } from "@/types/database";
import ConversationsClient from "./conversations-client";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";
import { getTenantLeadsLiteCached } from "@/lib/leads/get-tenant-leads-lite";
import { getConversationInitialDataCached } from "@/lib/conversations/get-conversation-initial-data";

type ConversationsPageProps = {
  searchParams: Promise<{ lead?: string }>;
};

export default async function ConversationsPage({
  searchParams,
}: ConversationsPageProps) {
  const { user, selectedTenantId } = await getAccessibleTenantsServer();
  const params = await searchParams;

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
