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

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id é obrigatório" },
        { status: 400 }
      );
    }

    // Total de leads
    const { count: totalLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    // Leads novos (últimos 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: newLeadsLast7Days } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", sevenDaysAgo.toISOString());

    // Leads quentes
    const { count: hotLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("temperature", "quente");

    // Leads com IA ativa
    const { count: aiActiveLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("ai_active", true);

    // Distribuição por status kanban
    const { data: allLeads } = await supabase
      .from("leads")
      .select("status_kanban, temperature, created_at")
      .eq("tenant_id", tenantId);

    const statusDistribution: Record<string, number> = {};
    const temperatureDistribution: Record<string, number> = {};
    const leadsOverTimeMap: Record<string, number> = {};

    if (allLeads) {
      for (const lead of allLeads) {
        // Status
        const status = lead.status_kanban || "novo";
        statusDistribution[status] = (statusDistribution[status] || 0) + 1;

        // Temperatura
        const temp = lead.temperature || "sem_info";
        temperatureDistribution[temp] = (temperatureDistribution[temp] || 0) + 1;

        // Leads ao longo do tempo (últimos 30 dias, por dia)
        const date = new Date(lead.created_at).toISOString().split("T")[0];
        leadsOverTimeMap[date] = (leadsOverTimeMap[date] || 0) + 1;
      }
    }

    // Formatar leads ao longo do tempo (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const leadsOverTime: { date: string; count: number }[] = [];
    for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      leadsOverTime.push({
        date: dateStr,
        count: leadsOverTimeMap[dateStr] || 0,
      });
    }

    // Status distribution formatado
    const statusDist = Object.entries(statusDistribution).map(
      ([status, count]) => ({
        status,
        count,
      })
    );

    // Temperature distribution formatado
    const tempDist = Object.entries(temperatureDistribution).map(
      ([temperature, count]) => ({
        temperature,
        count,
      })
    );

    // Novos desde último login
    const lastLogin = new Date();
    lastLogin.setDate(lastLogin.getDate() - 1); // fallback: último dia
    const { count: newSinceLastLogin } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .or(
        `created_at.gte.${lastLogin.toISOString()},last_interaction.gte.${lastLogin.toISOString()}`
      );

    return NextResponse.json({
      totalLeads: totalLeads || 0,
      newLeadsLast7Days: newLeadsLast7Days || 0,
      hotLeads: hotLeads || 0,
      aiActiveLeads: aiActiveLeads || 0,
      leadsOverTime,
      statusDistribution: statusDist,
      temperatureDistribution: tempDist,
      newSinceLastLogin: newSinceLastLogin || 0,
    });
  } catch (error) {
    console.error("Erro ao buscar métricas:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
