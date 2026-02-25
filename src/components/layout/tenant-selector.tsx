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
    return <Skeleton className="h-9 w-48" />;
  }

  // Se só tem 1 tenant, não precisa mostrar selector
  if (tenants.length <= 1) {
    return selectedTenant ? (
      <div className="flex items-center gap-2 text-sm font-medium">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span>{selectedTenant.name}</span>
      </div>
    ) : null;
  }

  return (
    <Select
      value={selectedTenant?.id || ""}
      onValueChange={setSelectedTenantId}
    >
      <SelectTrigger className="w-48">
        <Building2 className="mr-2 h-4 w-4" />
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
