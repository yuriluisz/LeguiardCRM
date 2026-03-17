import { redirect } from "next/navigation";
import type { FollowConfig } from "@/types/database";
import FollowupClient from "./followup-client";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";
import { getTenantLeadsLite } from "@/lib/leads/get-tenant-leads-lite";
import { DEFAULT_FOLLOW_CONFIG } from "@/types/database";

export default async function FollowupPage() {
  const { supabase, user, selectedTenantId, tenants } =
    await getAccessibleTenantsServer();

  if (!user) {
    redirect("/login");
  }

  if (!selectedTenantId) {
    return (
      <FollowupClient
        initialTenantId={null}
        initialLeads={[]}
        initialFollowStatus={false}
        initialFollowConfig={DEFAULT_FOLLOW_CONFIG}
      />
    );
  }

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) || null;
  const initialFollowStatus = Boolean(selectedTenant?.follow_status);
  const initialFollowConfig =
    (selectedTenant?.follow_config as FollowConfig | null) || DEFAULT_FOLLOW_CONFIG;
  const initialLeads = await getTenantLeadsLite(supabase, selectedTenantId, 300);

  return (
    <FollowupClient
      initialTenantId={selectedTenantId}
      initialLeads={initialLeads}
      initialFollowStatus={initialFollowStatus}
      initialFollowConfig={initialFollowConfig}
    />
  );
}
