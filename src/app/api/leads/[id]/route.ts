import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/types/database";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Buscar lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead não encontrado" },
        { status: 404 }
      );
    }

    // Normalize status_kanban to lowercase key expected by frontend
    if (lead && lead.status_kanban) {
      lead.status_kanban = String(lead.status_kanban).toLowerCase();
    }

    // Buscar interações
    const { data: interactions, error: interError } = await supabase
      .from("interactions")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: true });

    if (interError) throw interError;

    // Buscar dados do tenant (para crm_config)
    const { data: tenant } = await supabase
      .from("tenants")
      .select("crm_config")
      .eq("id", lead.tenant_id)
      .single();

    return NextResponse.json({
      lead,
      interactions: interactions || [],
      crmConfig: tenant?.crm_config || null,
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
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

    // Normalizar e validar campos antes de atualizar o DB
    if ("status_kanban" in updates) {
      const raw = updates.status_kanban;
      if (typeof raw !== "string") {
        return NextResponse.json({ error: "status_kanban inválido" }, { status: 400 });
      }

      const key = String(raw).toLowerCase();
      // STATUS_LABELS maps keys como 'novo' -> 'Novo'
      if (key in STATUS_LABELS) {
        updates.status_kanban = (STATUS_LABELS as Record<string, string>)[key];
      } else {
        // Try to convert to capitalized form as a fallback
        updates.status_kanban = `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
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

    const { data, error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro ao atualizar lead:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
