import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import KanbanClient from "./kanban-client";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";
import { getTenantLeadsLiteCached } from "@/lib/leads/get-tenant-leads-lite";
import { isDemoModeEnabledFromCookieStore } from "@/lib/demo/demo-mode";
import { getDemoLeads } from "@/lib/demo/demo-data";

export default async function KanbanPage() {
  const { user, selectedTenantId, tenants } = await getAccessibleTenantsServer();
  const cookieStore = await cookies();
  const demoMode = isDemoModeEnabledFromCookieStore(cookieStore);

  if (!user) {
    redirect("/login");
  }

  if (!selectedTenantId) {
    return <KanbanClient initialLeads={[]} initialTenantId={null} />;
  }

  if (demoMode) {
    const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? null;
    const initialLeads = getDemoLeads({
      tenantId: selectedTenantId,
      tenantName: selectedTenant?.name ?? undefined,
      kanbanColumns: selectedTenant?.kanban_config?.columns,
    });

    return (
      <KanbanClient
        initialLeads={initialLeads}
        initialTenantId={selectedTenantId}
      />
    );
  }

  const initialLeads = await getTenantLeadsLiteCached(selectedTenantId, 120);

  return (
    <KanbanClient
      initialLeads={initialLeads}
      initialTenantId={selectedTenantId}
    />
  );
}
