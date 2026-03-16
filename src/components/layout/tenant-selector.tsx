"use client";

import { useTenant } from "@/components/providers/tenant-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function TenantSelector() {
  const { tenants, selectedTenant, setSelectedTenantId, loading } = useTenant();

  if (loading) {
    return <Skeleton className="h-9 w-full sm:w-52" />;
  }

  // Se só tem 1 tenant, não precisa mostrar selector
  if (tenants.length <= 1) {
    return selectedTenant ? (
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{selectedTenant.name}</span>
      </div>
    ) : null;
  }

  return (
    <Select
      value={selectedTenant?.id || ""}
      onValueChange={setSelectedTenantId}
    >
      <SelectTrigger className="w-full max-w-full sm:w-52">
        <Building2 className="mr-2 h-4 w-4 shrink-0" />
        <SelectValue placeholder="Selecionar empresa" />
      </SelectTrigger>
      <SelectContent>
        {tenants.map((tenant) => (
          <SelectItem key={tenant.id} value={tenant.id}>
            {tenant.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
