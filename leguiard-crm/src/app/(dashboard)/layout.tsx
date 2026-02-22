import { TenantProvider } from "@/components/providers/tenant-provider";
import { AppShell } from "@/components/layout/app-shell";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TenantProvider>
      <AppShell>{children}</AppShell>
    </TenantProvider>
  );
}
