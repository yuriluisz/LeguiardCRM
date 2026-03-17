import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Tenant } from "@/types/database";
import { SELECTED_TENANT_COOKIE } from "@/lib/tenants/constants";

type AccessibleTenantsResult = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string | null } | null;
  userName: string | null;
  userEmail: string;
  isAdmin: boolean;
  tenants: Tenant[];
  selectedTenantId: string | null;
};

export const getAccessibleTenantsServer = cache(async (): Promise<AccessibleTenantsResult> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      userName: null,
      userEmail: "",
      isAdmin: false,
      tenants: [],
      selectedTenantId: null,
    };
  }

  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("name, is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = Boolean(crmUser?.is_admin);

  let tenants: Tenant[] = [];
  if (isAdmin) {
    const { data } = await supabase.from("tenants").select("*").order("name");
    tenants = (data as Tenant[]) || [];
  } else {
    const { data: userTenants } = await supabase
      .from("crm_user_tenants")
      .select("tenant_id")
      .eq("crm_user_id", user.id);

    if (userTenants && userTenants.length > 0) {
      const tenantIds = userTenants.map((entry: { tenant_id: string }) => entry.tenant_id);
      const { data } = await supabase
        .from("tenants")
        .select("*")
        .in("id", tenantIds)
        .order("name");
      tenants = (data as Tenant[]) || [];
    }
  }

  const cookieStore = await cookies();
  const cookieTenantId = cookieStore.get(SELECTED_TENANT_COOKIE)?.value || null;
  const selectedTenantId =
    cookieTenantId && tenants.some((tenant) => tenant.id === cookieTenantId)
      ? cookieTenantId
      : tenants[0]?.id || null;

  return {
    supabase,
    user: { id: user.id, email: user.email },
    userName: crmUser?.name || null,
    userEmail: user.email || "",
    isAdmin,
    tenants,
    selectedTenantId,
  };
});
