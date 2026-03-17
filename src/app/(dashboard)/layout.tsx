import { TenantProvider } from "@/components/providers/tenant-provider";
import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "next/navigation";
import { getAccessibleTenantsServer } from "@/lib/tenants/get-accessible-tenants-server";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenants, selectedTenantId, userName, userEmail, isAdmin } =
    await getAccessibleTenantsServer();

  if (!user) {
    redirect("/login");
  }

  return (
    <TenantProvider
      initialTenants={tenants}
      initialSelectedTenantId={selectedTenantId}
      initialUserName={userName}
      initialUserEmail={userEmail}
      initialIsAdmin={isAdmin}
    >
      <AppShell>{children}</AppShell>
    </TenantProvider>
  );
}
