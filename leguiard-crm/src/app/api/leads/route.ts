import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");
    const status = searchParams.get("status");
    const temperature = searchParams.get("temperature");
    const aiActive = searchParams.get("ai_active");
    const notALead = searchParams.get("not_a_lead");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id é obrigatório" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("leads")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("last_interaction", { ascending: false, nullsFirst: false });

    // Aplicar filtros
    if (status) {
      query = query.eq("status_kanban", status);
    }
    if (temperature) {
      query = query.eq("temperature", temperature);
    }
    if (aiActive !== null && aiActive !== undefined && aiActive !== "") {
      query = query.eq("ai_active", aiActive === "true");
    }
    if (notALead !== null && notALead !== undefined && notALead !== "") {
      query = query.eq("not_a_lead", notALead === "true");
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      leads: data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Erro ao buscar leads:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
