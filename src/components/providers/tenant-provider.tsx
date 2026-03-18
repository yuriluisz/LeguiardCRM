"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Tenant } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { SELECTED_TENANT_COOKIE } from "@/lib/tenants/constants";
import { isDemoModeEnabledOnClient, setDemoModeInClient } from "@/lib/demo/demo-mode";

interface TenantContextType {
  tenants: Tenant[];
  selectedTenant: Tenant | null;
  setSelectedTenantId: (id: string) => void;
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  userName: string | null;
  userEmail: string;
  isAdmin: boolean;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenants: [],
  selectedTenant: null,
  setSelectedTenantId: () => {},
  demoMode: false,
  setDemoMode: () => {},
  userName: null,
  userEmail: "",
  isAdmin: false,
  loading: true,
});

export function useTenant() {
  return useContext(TenantContext);
}

type TenantProviderProps = {
  children: React.ReactNode;
  initialTenants?: Tenant[];
  initialSelectedTenantId?: string | null;
  initialUserName?: string | null;
  initialUserEmail?: string;
  initialIsAdmin?: boolean;
};

function setTenantCookie(tenantId: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${SELECTED_TENANT_COOKIE}=${tenantId}; path=/; max-age=31536000; samesite=lax`;
}

export function TenantProvider({
  children,
  initialTenants,
  initialSelectedTenantId,
  initialUserName,
  initialUserEmail,
  initialIsAdmin,
}: TenantProviderProps) {
  const hasInitialData = Boolean(initialTenants);
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants ?? []);
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(
    initialSelectedTenantId ?? null
  );
  const [demoMode, setDemoModeState] = useState(false);
  const [userName, setUserName] = useState<string | null>(initialUserName ?? null);
  const [userEmail, setUserEmail] = useState<string>(initialUserEmail ?? "");
  const [isAdmin, setIsAdmin] = useState(Boolean(initialIsAdmin));
  const [loading, setLoading] = useState(!hasInitialData);

  const fetchTenants = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || "");

      // Buscar dados do crm_user
      const { data: crmUser } = await supabase
        .from("crm_users")
        .select("name, is_admin")
        .eq("id", user.id)
        .single();

      setUserName(crmUser?.name || null);
      setIsAdmin(Boolean(crmUser?.is_admin));

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
          const tenantIds = userTenants.map((ut: { tenant_id: string }) => ut.tenant_id);
          const { data } = await supabase
            .from("tenants")
            .select("*")
            .in("id", tenantIds)
            .order("name");
          tenantsData = (data as Tenant[]) || [];
        }
      }

      setTenants(tenantsData);

      const savedId = localStorage.getItem("selectedTenantId");
      if (savedId && tenantsData.some((t) => t.id === savedId)) {
        setSelectedTenantIdState(savedId);
        setTenantCookie(savedId);
      } else if (tenantsData.length > 0) {
        const nextTenantId = tenantsData[0].id;
        setSelectedTenantIdState(nextTenantId);
        localStorage.setItem("selectedTenantId", nextTenantId);
        setTenantCookie(nextTenantId);
      }
    } catch (error) {
      console.error("Erro ao carregar tenants:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasInitialData) {
      return;
    }

    fetchTenants();
  }, [fetchTenants, hasInitialData]);

  useEffect(() => {
    setDemoModeState(isDemoModeEnabledOnClient());
  }, []);

  useEffect(() => {
    if (!selectedTenantId) return;
    localStorage.setItem("selectedTenantId", selectedTenantId);
    setTenantCookie(selectedTenantId);
  }, [selectedTenantId]);

  const setSelectedTenantId = (id: string) => {
    setSelectedTenantIdState(id);
  };

  const setDemoMode = (enabled: boolean) => {
    setDemoModeState(enabled);
    setDemoModeInClient(enabled);
  };

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || null;

  return (
    <TenantContext.Provider
      value={{
        tenants,
        selectedTenant,
        setSelectedTenantId,
        demoMode,
        setDemoMode,
        userName,
        userEmail,
        isAdmin,
        loading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}
