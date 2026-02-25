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

    // Fetch leads created or interacted within the last 30 days for time series
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentLeads } = await supabase
      .from("leads")
      .select("id, created_at, last_interaction")
      .eq("tenant_id", tenantId)
      .or(
        `created_at.gte.${thirtyDaysAgo.toISOString()},last_interaction.gte.${thirtyDaysAgo.toISOString()}`
      );

    // Map counts per day
    const leadsPerDayMap: Record<string, number> = {};
    const conversationsPerDayMap: Record<string, Set<string>> = {};

    const leadIds: string[] = [];
    if (recentLeads) {
      for (const lead of recentLeads) {
        leadIds.push(lead.id);

        // Leads per day (created_at)
        if (lead.created_at) {
          const date = new Date(lead.created_at).toISOString().split("T")[0];
          leadsPerDayMap[date] = (leadsPerDayMap[date] || 0) + 1;
        }

        // Conversations per day: unique leads whose last_interaction falls on that day
        if (lead.last_interaction) {
          const liDate = new Date(lead.last_interaction).toISOString().split("T")[0];
          conversationsPerDayMap[liDate] = conversationsPerDayMap[liDate] || new Set();
          conversationsPerDayMap[liDate].add(lead.id);
        }
      }
    }

    // Fetch interactions for these leads in the last 30 days to compute messages per day and interactions today
    let interactions: any[] = [];
    if (leadIds.length > 0) {
      const { data: interactionsData } = await supabase
        .from("interactions")
        .select("created_at")
        .in("lead_id", leadIds)
        .gte("created_at", thirtyDaysAgo.toISOString());
      interactions = interactionsData || [];
    }

    const messagesPerDayMap: Record<string, number> = {};
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    let interactionsTodayCount = 0;

    for (const inter of interactions) {
      const d = new Date(inter.created_at).toISOString().split("T")[0];
      messagesPerDayMap[d] = (messagesPerDayMap[d] || 0) + 1;
      if (d === todayStr) interactionsTodayCount += 1;
    }

    // Formatar os últimos 30 dias para as séries temporais: leads por dia, conversas por dia, mensagens por dia
    const leadsPerDay: { date: string; count: number }[] = [];
    const conversationsPerDay: { date: string; count: number }[] = [];
    const messagesPerDay: { date: string; count: number }[] = [];

    const start = new Date();
    start.setDate(start.getDate() - 30);
    for (let d = new Date(start); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      leadsPerDay.push({ date: dateStr, count: leadsPerDayMap[dateStr] || 0 });
      conversationsPerDay.push({ date: dateStr, count: (conversationsPerDayMap[dateStr] && conversationsPerDayMap[dateStr].size) || 0 });
      messagesPerDay.push({ date: dateStr, count: messagesPerDayMap[dateStr] || 0 });
    }

    // Novos desde último login (último dia) - manter para badge/newness
    const lastLogin = new Date();
    lastLogin.setDate(lastLogin.getDate() - 1);
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
      interactionsToday: interactionsTodayCount || 0,
      leadsPerDay,
      conversationsPerDay,
      messagesPerDay,
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
