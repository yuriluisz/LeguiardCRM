import { redirect } from "next/navigation";
import KanbanClient from "./kanban-client";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";
import { getTenantLeadsLiteCached } from "@/lib/leads/get-tenant-leads-lite";

export default async function KanbanPage() {
  const { user, selectedTenantId } = await getAccessibleTenantsServer();

  if (!user) {
    redirect("/login");
  }

  if (!selectedTenantId) {
    return <KanbanClient initialLeads={[]} initialTenantId={null} />;
  }

  const initialLeads = await getTenantLeadsLiteCached(selectedTenantId, 120);

  return (
    <KanbanClient
      initialLeads={initialLeads}
      initialTenantId={selectedTenantId}
    />
  );
}
