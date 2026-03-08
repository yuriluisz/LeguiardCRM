import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  injectFollowupIntoPrompt,
  resolveFollowupInstructions,
  sanitizeFollowConfig,
} from "@/lib/followup/kanban-injection";
import type { AiConfigFollowup, FollowConfig } from "@/types/database";

async function ensureTenantAccess(userId: string, tenantId: string, isAdmin: boolean) {
  if (isAdmin) return true;

  const supabase = await createServerClient();
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

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase service role environment is missing");
  }

  return createAdminClient(url, serviceKey);
}

async function getAuthContext() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isAdmin: false };
  }

  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    isAdmin: Boolean(crmUser?.is_admin),
  };
}

function normalizeAiConfig(input: unknown, fallbackInstructions: string): AiConfigFollowup {
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};

  const model = typeof source.model === "string" ? source.model : "";
  const temperature =
    typeof source.temperature === "number" && Number.isFinite(source.temperature)
      ? source.temperature
      : 0.2;
  const instructions =
    typeof source.instructions === "string" ? source.instructions : fallbackInstructions;

  return {
    model,
    temperature,
    instructions,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthContext();

    if (!auth.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const canAccess = await ensureTenantAccess(auth.user.id, id, auth.isAdmin);
    if (!canAccess) {
      return NextResponse.json({ error: "Sem acesso a este tenant" }, { status: 403 });
    }

    const admin = getAdminClient();
    const { data: tenant, error } = await admin
      .from("tenants")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!tenant) {
      return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
    }

    const aiConfig = tenant.ai_config_followup;
    if (aiConfig && typeof aiConfig === "object") {
      const instructions = resolveFollowupInstructions(aiConfig as AiConfigFollowup);
      tenant.ai_config_followup = {
        ...(aiConfig as Record<string, unknown>),
        instructions,
      };
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Erro ao buscar tenant por id:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthContext();

    if (!auth.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const canAccess = await ensureTenantAccess(auth.user.id, id, auth.isAdmin);
    if (!canAccess) {
      return NextResponse.json({ error: "Sem acesso a este tenant" }, { status: 403 });
    }

    const body = await request.json();
    const admin = getAdminClient();

    const { data: existingTenant, error: existingError } = await admin
      .from("tenants")
      .select("id, follow_status, follow_config, ai_config_followup")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existingTenant) {
      return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    const wantsFollowStatus = Object.prototype.hasOwnProperty.call(body, "follow_status");
    const wantsFollowConfig = Object.prototype.hasOwnProperty.call(body, "follow_config");
    const wantsAiConfig = Object.prototype.hasOwnProperty.call(body, "ai_config_followup");

    if (!wantsFollowStatus && !wantsFollowConfig && !wantsAiConfig) {
      return NextResponse.json(
        { error: "Nenhum campo permitido para atualização" },
        { status: 400 }
      );
    }

    if (wantsFollowStatus) {
      updates.follow_status = Boolean(body.follow_status);
    }

    const existingFollowConfig = sanitizeFollowConfig(
      (existingTenant.follow_config ?? null) as FollowConfig | null
    );
    const nextFollowConfig = wantsFollowConfig
      ? sanitizeFollowConfig(body.follow_config as FollowConfig)
      : existingFollowConfig;

    if (wantsFollowConfig) {
      if ((nextFollowConfig.kanban.columns ?? []).length < 2) {
        return NextResponse.json(
          {
            error:
              "É obrigatório manter ao menos 2 etapas no pipeline de follow-up para salvar.",
          },
          { status: 400 }
        );
      }

      const oldColumns = [...(existingFollowConfig.kanban.columns ?? [])].sort(
        (a, b) => a.order - b.order
      );
      const newColumns = [...(nextFollowConfig.kanban.columns ?? [])].sort(
        (a, b) => a.order - b.order
      );

      const newKeys = new Set(newColumns.map((c) => c.key));
      const removedColumns = oldColumns.filter((c) => !newKeys.has(c.key));

      if (removedColumns.length > 0) {
        const removedLabels = removedColumns.map((c) => c.label);
        const { count, error: countError } = await admin
          .from("leads")
          .select("id", { head: true, count: "exact" })
          .eq("tenant_id", id)
          .in("follow_stage", removedLabels);

        if (countError) {
          throw countError;
        }

        if ((count ?? 0) > 0) {
          return NextResponse.json(
            {
              error:
                "Não foi possível excluir etapa: existem leads vinculados a pelo menos uma das etapas removidas.",
            },
            { status: 409 }
          );
        }
      }

      updates.follow_config = nextFollowConfig;
    }

    const existingAi = normalizeAiConfig(
      existingTenant.ai_config_followup,
      resolveFollowupInstructions(existingTenant.ai_config_followup as AiConfigFollowup)
    );
    const incomingAiRaw = wantsAiConfig ? body.ai_config_followup : null;
    const incomingAi = normalizeAiConfig(incomingAiRaw, existingAi.instructions);

    if (wantsAiConfig || wantsFollowConfig) {
      const baseInstructions = wantsAiConfig
        ? incomingAi.instructions
        : resolveFollowupInstructions(existingAi);

      const nextInstructions = wantsFollowConfig
        ? injectFollowupIntoPrompt(baseInstructions, nextFollowConfig)
        : baseInstructions;

      updates.ai_config_followup = {
        model: wantsAiConfig ? incomingAi.model : existingAi.model,
        temperature: wantsAiConfig ? incomingAi.temperature : existingAi.temperature,
        instructions: nextInstructions,
      } satisfies AiConfigFollowup;
    }

    const { data: updatedTenant, error: updateError } = await admin
      .from("tenants")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    if (wantsFollowConfig) {
      const oldByKey = new Map(
        existingFollowConfig.kanban.columns.map((col) => [col.key, col])
      );

      for (const col of nextFollowConfig.kanban.columns) {
        const previous = oldByKey.get(col.key);
        if (!previous) continue;
        if (previous.label === col.label) continue;

        const { error: renameError } = await admin
          .from("leads")
          .update({ follow_stage: col.label })
          .eq("tenant_id", id)
          .eq("follow_stage", previous.label);

        if (renameError) {
          throw renameError;
        }
      }
    }

    return NextResponse.json(updatedTenant);
  } catch (error) {
    console.error("Erro ao atualizar tenant:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
