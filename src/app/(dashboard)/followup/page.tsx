import { redirect } from "next/navigation";
import type { FollowConfig } from "@/types/database";
import FollowupClient from "./followup-client";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";
import { getTenantLeadsLiteCached } from "@/lib/leads/get-tenant-leads-lite";
import { DEFAULT_FOLLOW_CONFIG } from "@/types/database";
import { getTenantFollowupSettingsCached } from "@/lib/tenants/get-tenant-followup-settings";

export default async function FollowupPage() {
  const { user, selectedTenantId } =
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

  const [followupSettings, initialLeads] = await Promise.all([
    getTenantFollowupSettingsCached(selectedTenantId),
    getTenantLeadsLiteCached(selectedTenantId, 300),
  ]);

  const initialFollowStatus = followupSettings.followStatus;
  const initialFollowConfig =
    (followupSettings.followConfig as FollowConfig | null) || DEFAULT_FOLLOW_CONFIG;

  return (
    <FollowupClient
      initialTenantId={selectedTenantId}
      initialLeads={initialLeads}
      initialFollowStatus={initialFollowStatus}
      initialFollowConfig={initialFollowConfig}
    />
  );
}
