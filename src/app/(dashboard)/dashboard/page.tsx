import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";
import { getDashboardMetricsCached } from "@/lib/dashboard/get-dashboard-metrics";

export default async function DashboardPage() {
  const { user, selectedTenantId } = await getAccessibleTenantsServer();

  if (!user) {
    redirect("/login");
  }

  if (!selectedTenantId) {
    return <DashboardClient initialMetrics={null} initialTenantId={null} />;
  }

  const initialMetrics = await getDashboardMetricsCached(selectedTenantId);

  return (
    <DashboardClient
      initialMetrics={initialMetrics}
      initialTenantId={selectedTenantId}
    />
  );
}
