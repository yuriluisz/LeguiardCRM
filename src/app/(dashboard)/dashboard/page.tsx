import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import DashboardClient from "./dashboard-client";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";
import { getDashboardMetricsCached } from "@/lib/dashboard/get-dashboard-metrics";
import { isDemoModeEnabledFromCookieStore } from "@/lib/demo/demo-mode";
import { getDemoDashboardMetrics, getDemoFollowConfig } from "@/lib/demo/demo-data";

export default async function DashboardPage() {
  const { user, selectedTenantId, tenants } = await getAccessibleTenantsServer();
  const cookieStore = await cookies();
  const demoMode = isDemoModeEnabledFromCookieStore(cookieStore);

  if (!user) {
    redirect("/login");
  }

  if (!selectedTenantId) {
    return <DashboardClient initialMetrics={null} initialTenantId={null} />;
  }

  if (demoMode) {
    const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? null;
    const initialMetrics = getDemoDashboardMetrics({
      tenantId: selectedTenantId,
      tenantName: selectedTenant?.name ?? undefined,
      kanbanColumns: selectedTenant?.kanban_config?.columns,
      followConfig: getDemoFollowConfig(),
    });

    return (
      <DashboardClient
        initialMetrics={initialMetrics}
        initialTenantId={selectedTenantId}
      />
    );
  }

  const initialMetrics = await getDashboardMetricsCached(selectedTenantId);

  return (
    <DashboardClient
      initialMetrics={initialMetrics}
      initialTenantId={selectedTenantId}
    />
  );
}
