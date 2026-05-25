import { NextRequest, NextResponse } from "next/server";
import { ensureTenantAccess, getAuthenticatedContext } from "@/lib/auth/tenant-access";
import { DEFAULT_KANBAN_COLUMNS } from "@/types/database";

async function resolveLeadWithAccess(id: string) {
  const auth = await getAuthenticatedContext();

  if (!auth.user) {
    return { auth, lead: null, error: "Não autenticado", status: 401 };
  }

  const { data: lead, error: leadError } = await auth.supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (leadError || !lead) {
    return { auth, lead: null, error: "Lead não encontrado", status: 404 };
  }

  const canAccess = await ensureTenantAccess(auth.user.id, lead.tenant_id, auth.isAdmin);
  if (!canAccess) {
    return { auth, lead: null, error: "Sem acesso a este lead", status: 403 };
  }

  return { auth, lead, error: null, status: 200 };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { auth, lead, error, status } = await resolveLeadWithAccess(id);
    if (!lead) {
      return NextResponse.json({ error }, { status });
    }

    // Normalize status_kanban to lowercase key expected by frontend
    if (lead && lead.status_kanban) {
      lead.status_kanban = String(lead.status_kanban).toLowerCase();
    }

    // Buscar interações
    const { data: interactions, error: interError } = await auth.supabase
      .from("interactions")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: true });

    if (interError) throw interError;

    // Buscar dados do tenant (para crm_config e kanban_config)
    const { data: tenant } = await auth.supabase
      .from("tenants")
      .select("crm_config, kanban_config")
      .eq("id", lead.tenant_id)
      .single();

    return NextResponse.json({
      lead,
      interactions: interactions || [],
      crmConfig: tenant?.crm_config || null,
      kanbanConfig: tenant?.kanban_config || null,
    });
  } catch (error) {
    console.error("Erro ao buscar lead:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { auth, lead: existingLeadWithAccess, error, status } = await resolveLeadWithAccess(id);
    if (!existingLeadWithAccess) {
      return NextResponse.json({ error }, { status });
    }

    const body = await request.json();


    // Apenas campos permitidos
    const allowedFields = ["status_kanban", "ai_active", "not_a_lead", "conv_id", "custom_data"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    // Validate custom_data shape and size
    if ("custom_data" in updates) {
      const cd = updates.custom_data;
      if (cd !== null && (typeof cd !== "object" || Array.isArray(cd))) {
        return NextResponse.json({ error: "custom_data deve ser um objeto ou null" }, { status: 400 });
      }
      if (cd !== null) {
        const serialized = JSON.stringify(cd);
        if (serialized.length > 10_000) {
          return NextResponse.json({ error: "custom_data excede o tamanho máximo permitido (10KB)" }, { status: 400 });
        }
      }
    }

    // Normalizar e validar campos antes de atualizar o DB
    if ("status_kanban" in updates) {
      const raw = updates.status_kanban;
      if (typeof raw !== "string") {
        return NextResponse.json({ error: "status_kanban inválido" }, { status: 400 });
      }

      const key = String(raw).toLowerCase();

      // Buscar lead para pegar tenant_id
      // Buscar kanban_config do tenant para validar status
      const { data: tenant } = await auth.supabase
        .from("tenants")
        .select("kanban_config")
        .eq("id", existingLeadWithAccess.tenant_id)
        .single();

      const columns = tenant?.kanban_config?.columns ?? DEFAULT_KANBAN_COLUMNS;
      const validColumn = columns.find((c: { key: string; label: string }) => c.key === key);

      if (validColumn) {
        // Salva no formato capitalizado que o DB espera
        updates.status_kanban = validColumn.label;
      } else {
        return NextResponse.json(
          { error: `status_kanban inválido: "${key}" não existe na configuração do kanban` },
          { status: 400 }
        );
      }
    }

    if ("ai_active" in updates) {
      updates.ai_active = Boolean(updates.ai_active);
    }

    if ("not_a_lead" in updates) {
      updates.not_a_lead = Boolean(updates.not_a_lead);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo válido para atualização" },
        { status: 400 }
      );
    }

    const { data, error: updateError } = await auth.supabase
      .from("leads")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro ao atualizar lead:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
