import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type CrmUserValidateRow = {
  id: string;
  email: string;
  name: string | null;
  newuser_token_expires_at?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "token é obrigatório" }, { status: 400 });
    }

    const supabase = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE);

    // Select all columns to be tolerant if schema differs between environments.
    const { data, error } = await supabase
      .from("crm_users")
      .select("*")
      .eq("newuser_token", token)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar crm_user:", error?.message || error, error?.details || "");
      // Return the supabase error message in dev to aid debugging (safe to remove in production)
      return NextResponse.json({ error: "Erro interno", detail: error?.message || null }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Token inválido ou usuário inativo" }, { status: 404 });
    }

    // If the column exists, enforce expiration.
    const row = data as CrmUserValidateRow;
    const expiresAt = row.newuser_token_expires_at;
    if (expiresAt) {
      const expires = new Date(expiresAt);
      if (isNaN(expires.getTime())) {
        console.warn("newuser_token_expires_at possui formato inválido:", expiresAt);
      } else if (expires < new Date()) {
        return NextResponse.json({ error: "Token expirado" }, { status: 410 });
      }
    }

    return NextResponse.json({ id: row.id, email: row.email, name: row.name });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
