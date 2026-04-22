import { NextRequest, NextResponse } from "next/server";
import { ensureTenantAccess, getAuthenticatedContext } from "@/lib/auth/tenant-access";
import { getDashboardMetricsCached } from "@/lib/dashboard/get-dashboard-metrics";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, isAdmin, tenantIdsFromClaim } = await getAuthenticatedContext();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id é obrigatório" },
        { status: 400 }
      );
    }

    const canAccess = await ensureTenantAccess(user.id, tenantId, isAdmin, {
      supabase,
      tenantIdsFromClaim,
    });
    if (!canAccess) {
      return NextResponse.json({ error: "Sem acesso a este tenant" }, { status: 403 });
    }

    const metrics = await getDashboardMetricsCached(tenantId);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Erro ao buscar métricas:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
