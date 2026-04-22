import { createClient } from "@/lib/supabase/server";
import { getIsAdminFromJwt, getTenantIdsFromJwt } from "@/lib/auth/jwt-claims";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type EnsureTenantAccessOptions = {
  supabase?: SupabaseServerClient;
  tenantIdsFromClaim?: readonly string[] | null;
};

export async function getAuthenticatedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, isAdmin: false, tenantIdsFromClaim: null };
  }

  const isAdminFromJwt = getIsAdminFromJwt(user);
  const tenantIdsFromClaim = getTenantIdsFromJwt(user);

  if (isAdminFromJwt !== null) {
    return {
      supabase,
      user,
      isAdmin: isAdminFromJwt,
      tenantIdsFromClaim,
    };
  }

  const { data: crmUser, error } = await supabase
    .from("crm_users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    supabase,
    user,
    isAdmin: Boolean(crmUser?.is_admin),
    tenantIdsFromClaim,
  };
}

export async function ensureTenantAccess(
  userId: string,
  tenantId: string,
  isAdmin: boolean,
  options?: EnsureTenantAccessOptions
) {
  if (isAdmin) {
    return true;
  }

  if (Array.isArray(options?.tenantIdsFromClaim)) {
    return options.tenantIdsFromClaim.includes(tenantId);
  }

  const supabase = options?.supabase || (await createClient());
  const { data, error } = await supabase
    .from("crm_user_tenants")
    .select("id")
    .eq("crm_user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}