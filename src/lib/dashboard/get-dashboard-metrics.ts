import {
  DEFAULT_FOLLOW_CONFIG,
  DEFAULT_KANBAN_COLUMNS,
  type DashboardMetrics,
  type FollowConfig,
  type FollowKanbanColumnConfig,
  type KanbanColumnConfig,
} from "@/types/database";
import { createClient } from "@/lib/supabase/server";

function normalizeStage(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getDashboardMetrics(
  supabase: SupabaseServerClient,
  tenantId: string
): Promise<DashboardMetrics> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const lastLogin = new Date();
  lastLogin.setDate(lastLogin.getDate() - 1);

  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

  const [
    { count: totalLeads },
    { data: tenantConfigData },
    { data: recentLeads },
    { data: leadsSnapshot },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("tenants")
      .select("kanban_config, follow_config, plan_level")
      .eq("id", tenantId)
      .single(),
    supabase
      .from("leads")
      .select("id, created_at, last_interaction")
      .eq("tenant_id", tenantId)
      .or(
        `created_at.gte.${thirtyDaysAgoIso},last_interaction.gte.${thirtyDaysAgoIso}`
      ),
    supabase
      .from("leads")
      .select("status_kanban, follow_stage, last_interaction, created_at")
      .eq("tenant_id", tenantId),
  ]);

  const isBronzeTenant =
    String(tenantConfigData?.plan_level || "").toLowerCase() === "bronze";

  const kanbanColumns: KanbanColumnConfig[] =
    tenantConfigData?.kanban_config?.columns?.length
      ? [...tenantConfigData.kanban_config.columns].sort(
          (a: KanbanColumnConfig, b: KanbanColumnConfig) => a.order - b.order
        )
      : DEFAULT_KANBAN_COLUMNS;

  const followConfig =
    (tenantConfigData?.follow_config as FollowConfig | null) ??
    DEFAULT_FOLLOW_CONFIG;
  const followColumns: FollowKanbanColumnConfig[] =
    !isBronzeTenant && followConfig?.kanban?.columns?.length
      ? [...followConfig.kanban.columns].sort((a, b) => a.order - b.order)
      : [];

  let newLeadsLast7Days = 0;
  let newLeadsToday = 0;
  let newSinceLastLogin = 0;

  const leadsPerDayMap: Record<string, number> = {};
  const conversationsPerDayMap: Record<string, Set<string>> = {};

  const leadIds: string[] = [];
  if (recentLeads) {
    for (const lead of recentLeads) {
      leadIds.push(lead.id);

      const createdAt = lead.created_at ? new Date(lead.created_at) : null;
      const lastInteractionAt = lead.last_interaction
        ? new Date(lead.last_interaction)
        : null;

      if (createdAt && createdAt >= sevenDaysAgo) {
        newLeadsLast7Days += 1;
      }

      if (createdAt && createdAt >= todayStart && createdAt < tomorrowStart) {
        newLeadsToday += 1;
      }

      if (
        (createdAt && createdAt >= lastLogin) ||
        (lastInteractionAt && lastInteractionAt >= lastLogin)
      ) {
        newSinceLastLogin += 1;
      }

      if (lead.created_at) {
        const date = new Date(lead.created_at).toISOString().split("T")[0];
        leadsPerDayMap[date] = (leadsPerDayMap[date] || 0) + 1;
      }

      if (lead.last_interaction) {
        const interactionDate = new Date(lead.last_interaction)
          .toISOString()
          .split("T")[0];
        conversationsPerDayMap[interactionDate] =
          conversationsPerDayMap[interactionDate] || new Set();
        conversationsPerDayMap[interactionDate].add(lead.id);
      }
    }
  }

  let interactions: { created_at: string }[] = [];
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

  for (const interaction of interactions) {
    const date = new Date(interaction.created_at).toISOString().split("T")[0];
    messagesPerDayMap[date] = (messagesPerDayMap[date] || 0) + 1;
    if (date === todayStr) interactionsTodayCount += 1;
  }

  const kanbanCountMap = new Map<string, number>();
  const kanbanMatchMap = new Map<string, string>();
  const finalStageKeys = new Set<string>();

  for (const col of kanbanColumns) {
    kanbanCountMap.set(col.key, 0);
    kanbanMatchMap.set(normalizeStage(col.key), col.key);
    kanbanMatchMap.set(normalizeStage(col.label), col.key);
    if (col.is_final) {
      finalStageKeys.add(col.key);
    }
  }

  const followCountMap = new Map<string, number>();
  const followMatchMap = new Map<string, string>();
  for (const col of followColumns) {
    followCountMap.set(col.label, 0);
    followMatchMap.set(normalizeStage(col.label), col.label);
    followMatchMap.set(normalizeStage(col.key), col.label);
  }

  const stagnationThresholdDays = 3;
  const stagnantCutoff = new Date();
  stagnantCutoff.setDate(stagnantCutoff.getDate() - stagnationThresholdDays);
  let leadsStagnated = 0;

  if (leadsSnapshot) {
    for (const lead of leadsSnapshot) {
      const mappedKanbanKey = kanbanMatchMap.get(
        normalizeStage(lead.status_kanban)
      );
      if (mappedKanbanKey) {
        kanbanCountMap.set(
          mappedKanbanKey,
          (kanbanCountMap.get(mappedKanbanKey) || 0) + 1
        );

        if (!finalStageKeys.has(mappedKanbanKey)) {
          const latestActivityIso = lead.last_interaction || lead.created_at;
          if (latestActivityIso) {
            const latestActivityDate = new Date(latestActivityIso);
            if (latestActivityDate < stagnantCutoff) {
              leadsStagnated += 1;
            }
          }
        }
      }

      const mappedFollowLabel = followMatchMap.get(
        normalizeStage(lead.follow_stage)
      );
      if (mappedFollowLabel) {
        followCountMap.set(
          mappedFollowLabel,
          (followCountMap.get(mappedFollowLabel) || 0) + 1
        );
      }
    }
  }

  const kanbanFunnel = kanbanColumns.map((col) => ({
    key: col.key,
    label: col.label,
    count: kanbanCountMap.get(col.key) || 0,
    color: col.color,
    order: col.order,
  }));

  const followupDistribution = followColumns.map((col) => ({
    stage: col.label,
    count: followCountMap.get(col.label) || 0,
    color: col.color,
    order: col.order,
  }));

  const firstKanbanColumn = kanbanColumns[0];
  const finalKanbanColumn =
    kanbanColumns.find((col) => col.is_final) ||
    kanbanColumns[kanbanColumns.length - 1];
  const firstStageCount = firstKanbanColumn
    ? (kanbanCountMap.get(firstKanbanColumn.key) || 0)
    : 0;
  const finalStageCount = finalKanbanColumn
    ? (kanbanCountMap.get(finalKanbanColumn.key) || 0)
    : 0;
  const funnelConversionRate =
    firstStageCount > 0
      ? Number(((finalStageCount / firstStageCount) * 100).toFixed(2))
      : 0;

  const leadsPerDay: { date: string; count: number }[] = [];
  const conversationsPerDay: { date: string; count: number }[] = [];
  const messagesPerDay: { date: string; count: number }[] = [];

  const start = new Date();
  start.setDate(start.getDate() - 30);
  for (let day = new Date(start); day <= new Date(); day.setDate(day.getDate() + 1)) {
    const dateStr = day.toISOString().split("T")[0];
    leadsPerDay.push({ date: dateStr, count: leadsPerDayMap[dateStr] || 0 });
    conversationsPerDay.push({
      date: dateStr,
      count:
        (conversationsPerDayMap[dateStr] &&
          conversationsPerDayMap[dateStr].size) ||
        0,
    });
    messagesPerDay.push({ date: dateStr, count: messagesPerDayMap[dateStr] || 0 });
  }

  return {
    totalLeads: totalLeads || 0,
    newLeadsLast7Days: newLeadsLast7Days || 0,
    newLeadsToday: newLeadsToday || 0,
    interactionsToday: interactionsTodayCount || 0,
    leadsStagnated,
    stagnationThresholdDays,
    funnelConversionRate,
    kanbanFunnel,
    followupDistribution,
    leadsPerDay,
    conversationsPerDay,
    messagesPerDay,
    newSinceLastLogin: newSinceLastLogin || 0,
  };
}
