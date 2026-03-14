import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, isAdmin: false };
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
  };
}

export async function ensureTenantAccess(
  userId: string,
  tenantId: string,
  isAdmin: boolean
) {
  if (isAdmin) {
    return true;
  }

  const supabase = await createClient();
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