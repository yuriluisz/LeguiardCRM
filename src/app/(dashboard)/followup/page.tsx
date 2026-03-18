import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { FollowConfig } from "@/types/database";
import FollowupClient from "./followup-client";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";
import { getTenantLeadsLiteCached } from "@/lib/leads/get-tenant-leads-lite";
import { DEFAULT_FOLLOW_CONFIG } from "@/types/database";
import { getTenantFollowupSettingsCached } from "@/lib/tenants/get-tenant-followup-settings";
import { isDemoModeEnabledFromCookieStore } from "@/lib/demo/demo-mode";
import { getDemoFollowConfig, getDemoLeads } from "@/lib/demo/demo-data";

export default async function FollowupPage() {
  const { user, selectedTenantId, tenants } =
    await getAccessibleTenantsServer();
  const cookieStore = await cookies();
  const demoMode = isDemoModeEnabledFromCookieStore(cookieStore);

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

  if (demoMode) {
    const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? null;
    const initialFollowConfig = getDemoFollowConfig();
    const initialLeads = getDemoLeads({
      tenantId: selectedTenantId,
      tenantName: selectedTenant?.name ?? undefined,
      kanbanColumns: selectedTenant?.kanban_config?.columns,
      followConfig: initialFollowConfig,
    });

    return (
      <FollowupClient
        initialTenantId={selectedTenantId}
        initialLeads={initialLeads}
        initialFollowStatus={true}
        initialFollowConfig={initialFollowConfig}
      />
    );
  }

  const [followupSettings, initialLeads] = await Promise.all([
    getTenantFollowupSettingsCached(selectedTenantId),
    getTenantLeadsLiteCached(selectedTenantId, 120),
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
