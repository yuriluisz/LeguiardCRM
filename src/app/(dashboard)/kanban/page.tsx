import { redirect } from "next/navigation";
import KanbanClient from "./kanban-client";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";
import { getTenantLeadsLite } from "@/lib/leads/get-tenant-leads-lite";

export default async function KanbanPage() {
  const { supabase, user, selectedTenantId } = await getAccessibleTenantsServer();

  if (!user) {
    redirect("/login");
  }

  if (!selectedTenantId) {
    return <KanbanClient initialLeads={[]} initialTenantId={null} />;
  }

  const initialLeads = await getTenantLeadsLite(supabase, selectedTenantId, 300);

  return (
    <KanbanClient
      initialLeads={initialLeads}
      initialTenantId={selectedTenantId}
    />
  );
}
