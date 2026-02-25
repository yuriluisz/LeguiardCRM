"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Tenant } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

interface TenantContextType {
  tenants: Tenant[];
  selectedTenant: Tenant | null;
  setSelectedTenantId: (id: string) => void;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenants: [],
  selectedTenant: null,
  setSelectedTenantId: () => {},
  loading: true,
});

export function useTenant() {
  return useContext(TenantContext);
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenants = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar dados do crm_user
      const { data: crmUser } = await supabase
        .from("crm_users")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      let tenantsData: Tenant[] = [];

      if (crmUser?.is_admin) {
        // Admin vê todos os tenants ativos
        const { data } = await supabase
          .from("tenants")
          .select("*")
          .order("name");
        tenantsData = (data as Tenant[]) || [];
      } else {
        // Usuário regular vê apenas tenants vinculados
        const { data: userTenants } = await supabase
          .from("crm_user_tenants")
          .select("tenant_id")
          .eq("crm_user_id", user.id);

        if (userTenants && userTenants.length > 0) {
          const tenantIds = userTenants.map((ut) => ut.tenant_id);
          const { data } = await supabase
            .from("tenants")
            .select("*")
            .in("id", tenantIds)
            .order("name");
          tenantsData = (data as Tenant[]) || [];
        }
      }

      setTenants(tenantsData);

      // Restaurar seleção do localStorage ou auto-selecionar
      const savedId = localStorage.getItem("selectedTenantId");
      if (savedId && tenantsData.some((t) => t.id === savedId)) {
        setSelectedTenantIdState(savedId);
      } else if (tenantsData.length > 0) {
        setSelectedTenantIdState(tenantsData[0].id);
        localStorage.setItem("selectedTenantId", tenantsData[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar tenants:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const setSelectedTenantId = (id: string) => {
    setSelectedTenantIdState(id);
    localStorage.setItem("selectedTenantId", id);
  };

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || null;

  return (
    <TenantContext.Provider
      value={{ tenants, selectedTenant, setSelectedTenantId, loading }}
    >
      {children}
    </TenantContext.Provider>
  );
}
