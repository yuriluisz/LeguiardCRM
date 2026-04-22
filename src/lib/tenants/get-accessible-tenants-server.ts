import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getIsAdminFromJwt,
  getTenantIdsFromJwt,
  getUserNameFromJwt,
} from "@/lib/auth/jwt-claims";
import type { Tenant } from "@/types/database";
import { SELECTED_TENANT_COOKIE } from "@/lib/tenants/constants";

const TENANTS_BASE_SELECT = "id,name,description,plan_level,kanban_config,follow_status";

type TenantBaseRow = Pick<
  Tenant,
  "id" | "name" | "description" | "plan_level" | "kanban_config" | "follow_status"
>;

function normalizeTenant(row: TenantBaseRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    plan_level: row.plan_level,
    kanban_config: row.kanban_config,
    follow_status: row.follow_status,
    crm_config: null,
    ai_config_followup: null,
    follow_config: null,
  };
}

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

  const isAdminFromJwt = getIsAdminFromJwt(user);
  const tenantIdsFromClaim = getTenantIdsFromJwt(user);
  let userName = getUserNameFromJwt(user);
  let isAdmin = false;

  if (isAdminFromJwt !== null) {
    isAdmin = isAdminFromJwt;
  } else {
    const { data: crmUser } = await supabase
      .from("crm_users")
      .select("name, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (crmUser?.name) {
      userName = crmUser.name;
    }

    isAdmin = Boolean(crmUser?.is_admin);
  }

  let tenants: Tenant[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("tenants")
      .select(TENANTS_BASE_SELECT)
      .order("name");
    tenants = ((data as TenantBaseRow[] | null) || []).map(normalizeTenant);
  } else if (tenantIdsFromClaim !== null) {
    if (tenantIdsFromClaim.length > 0) {
      const { data } = await supabase
        .from("tenants")
        .select(TENANTS_BASE_SELECT)
        .in("id", tenantIdsFromClaim)
        .order("name");
      tenants = ((data as TenantBaseRow[] | null) || []).map(normalizeTenant);
    }
  } else {
    const { data: userTenants } = await supabase
      .from("crm_user_tenants")
      .select("tenant_id")
      .eq("crm_user_id", user.id);

    if (userTenants && userTenants.length > 0) {
      const tenantIds = userTenants.map((entry: { tenant_id: string }) => entry.tenant_id);
      const { data } = await supabase
        .from("tenants")
        .select(TENANTS_BASE_SELECT)
        .in("id", tenantIds)
        .order("name");
      tenants = ((data as TenantBaseRow[] | null) || []).map(normalizeTenant);
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
    userName,
    userEmail: user.email || "",
    isAdmin,
    tenants,
    selectedTenantId,
  };
});
