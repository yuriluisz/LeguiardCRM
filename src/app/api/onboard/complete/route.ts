import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, user_id, new_password } = body || {};

    if (!token || !user_id || !new_password) {
      return NextResponse.json({ error: "token, user_id e new_password são obrigatórios" }, { status: 400 });
    }

    if (typeof new_password !== "string" || new_password.length < 8) {
      return NextResponse.json({ error: "Senha deve ter ao menos 8 caracteres" }, { status: 400 });
    }

    const supabase = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE);

    // Re-validate token in crm_users (single-use)
    const { data: crmUser, error: findErr } = await supabase
      .from("crm_users")
      .select("id, newuser_token_expires_at")
      .eq("id", user_id)
      .eq("newuser_token", token)
      .eq("active", true)
      .maybeSingle();

    if (findErr) {
      console.error("Erro ao buscar crm_user:", findErr);
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }

    if (!crmUser) {
      return NextResponse.json({ error: "Token inválido ou usuário inativo" }, { status: 404 });
    }

    if (crmUser.newuser_token_expires_at) {
      const expires = new Date(crmUser.newuser_token_expires_at);
      if (expires < new Date()) {
        return NextResponse.json({ error: "Token expirado" }, { status: 410 });
      }
    }

    // Update password in Supabase Auth using service role
    const { data: authData, error: authErr } = await supabase.auth.admin.updateUserById(user_id, {
      password: new_password,
    } as any);

    if (authErr) {
      console.error("Erro ao atualizar senha no Auth:", authErr);
      return NextResponse.json({ error: "Falha ao atualizar senha" }, { status: 500 });
    }

    // Clear token and mark used
    const { error: updErr } = await supabase
      .from("crm_users")
      .update({ newuser_token: null, newuser_token_used_at: new Date().toISOString() })
      .eq("id", user_id);

    if (updErr) {
      console.error("Erro ao limpar token:", updErr);
      // Don't remove auth change - return error to client
      return NextResponse.json({ error: "Erro ao atualizar registro do usuário" }, { status: 500 });
    }

    // Insert audit record (best effort)
    try {
      await supabase.from("crm_users_audit").insert({
        crm_user_id: user_id,
        action: "completed_onboarding",
        performed_by: user_id,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Falha ao inserir auditoria:", e);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
