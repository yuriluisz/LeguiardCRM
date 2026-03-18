import { NextRequest, NextResponse } from "next/server";
import { ensureTenantAccess, getAuthenticatedContext } from "@/lib/auth/tenant-access";

type LeadRow = Record<string, unknown> & {
  status_kanban?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, isAdmin } = await getAuthenticatedContext();

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
    const lite = searchParams.get("lite") === "true";
    const pageRaw = Number.parseInt(searchParams.get("page") || "1", 10);
    const limitRaw = Number.parseInt(searchParams.get("limit") || "50", 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 100)
      : 50;

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id é obrigatório" },
        { status: 400 }
      );
    }

    const canAccess = await ensureTenantAccess(user.id, tenantId, isAdmin);
    if (!canAccess) {
      return NextResponse.json({ error: "Sem acesso a este tenant" }, { status: 403 });
    }

    const selectFields = lite
      ? "id,tenant_id,phone,name,email,status_kanban,temperature,ai_active,not_a_lead,last_interaction,created_at,ai_run_count,conv_id,follow_stage"
      : "*";

    let query = supabase
      .from("leads")
      .select(selectFields, { count: "exact" })
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

    // Normalize status_kanban to lowercase keys expected by the frontend
    const rawRows = ((data ?? []) as unknown) as LeadRow[];
    const normalized = rawRows.map((lead) => ({
      ...lead,
      status_kanban: lead.status_kanban ? String(lead.status_kanban).toLowerCase() : lead.status_kanban,
    }));

    return NextResponse.json({
      leads: normalized,
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
