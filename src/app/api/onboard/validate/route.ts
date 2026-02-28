import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "token é obrigatório" }, { status: 400 });
    }

    const supabase = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE);

    const { data, error } = await supabase
      .from("crm_users")
      .select("id, email, name, newuser_token_expires_at")
      .eq("newuser_token", token)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar crm_user:", error);
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Token inválido ou usuário inativo" }, { status: 404 });
    }

    if (data.newuser_token_expires_at) {
      const expires = new Date(data.newuser_token_expires_at);
      if (expires < new Date()) {
        return NextResponse.json({ error: "Token expirado" }, { status: 410 });
      }
    }

    return NextResponse.json({ id: data.id, email: data.email, name: data.name });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
