import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/tenant-access";

export async function GET() {
  try {
    const { supabase, user, isAdmin, tenantIdsFromClaim } = await getAuthenticatedContext();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (isAdmin) {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("name");

      if (error) throw error;

      return NextResponse.json(data || []);
    }

    let tenantIds = tenantIdsFromClaim;
    if (tenantIds === null) {
      const { data: userTenants, error: utError } = await supabase
        .from("crm_user_tenants")
        .select("tenant_id")
        .eq("crm_user_id", user.id);

      if (utError) throw utError;

      tenantIds = (userTenants || []).map((ut: { tenant_id: string }) => ut.tenant_id);
    }

    if (!tenantIds || tenantIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .in("id", tenantIds)
      .order("name");

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Erro ao buscar tenants:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
