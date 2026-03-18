import { NextRequest, NextResponse } from "next/server";
import { ensureTenantAccess, getAuthenticatedContext } from "@/lib/auth/tenant-access";
import { getDashboardMetrics } from "@/lib/dashboard/get-dashboard-metrics";
import { isDemoModeEnabledForRequestCookie } from "@/lib/demo/demo-mode";
import { getDemoDashboardMetrics, getDemoFollowConfig } from "@/lib/demo/demo-data";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, isAdmin } = await getAuthenticatedContext();
    const demoMode = isDemoModeEnabledForRequestCookie(request.cookies.get("crm_demo_mode")?.value);

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

    const canAccess = await ensureTenantAccess(user.id, tenantId, isAdmin);
    if (!canAccess) {
      return NextResponse.json({ error: "Sem acesso a este tenant" }, { status: 403 });
    }

    if (demoMode) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, kanban_config")
        .eq("id", tenantId)
        .maybeSingle();

      return NextResponse.json(
        getDemoDashboardMetrics({
          tenantId,
          tenantName: tenant?.name ?? undefined,
          kanbanColumns: tenant?.kanban_config?.columns,
          followConfig: getDemoFollowConfig(),
        })
      );
    }

    const metrics = await getDashboardMetrics(supabase, tenantId);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Erro ao buscar métricas:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
