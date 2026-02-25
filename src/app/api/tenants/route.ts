import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Verificar se é admin
    const { data: crmUser } = await supabase
      .from("crm_users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!crmUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    let tenants;

    if (crmUser.is_admin) {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("name");

      if (error) throw error;
      tenants = data;
    } else {
      // Buscar tenants vinculados ao usuário
      const { data: userTenants, error: utError } = await supabase
        .from("crm_user_tenants")
        .select("tenant_id")
        .eq("crm_user_id", user.id);

      if (utError) throw utError;

      if (userTenants && userTenants.length > 0) {
        const tenantIds = userTenants.map((ut) => ut.tenant_id);
        const { data, error } = await supabase
          .from("tenants")
          .select("*")
          .in("id", tenantIds)
          .order("name");

        if (error) throw error;
        tenants = data;
      } else {
        tenants = [];
      }
    }

    return NextResponse.json(tenants);
  } catch (error) {
    console.error("Erro ao buscar tenants:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
