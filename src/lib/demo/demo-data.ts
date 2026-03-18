import {
  DEFAULT_FOLLOW_CONFIG,
  DEFAULT_KANBAN_COLUMNS,
  type CrmConfig,
  type DashboardMetrics,
  type FollowConfig,
  type Interaction,
  type KanbanColumnConfig,
  type Lead,
  type Tenant,
  type Temperature,
} from "@/types/database";

type DemoOptions = {
  tenantId?: string;
  tenantName?: string;
  kanbanColumns?: KanbanColumnConfig[];
  followConfig?: FollowConfig;
};

const DEMO_CRM_CONFIG: CrmConfig = {
  fields: [
    { key: "origem", type: "select", label: "Origem" },
    { key: "orcamento", type: "number", label: "Orcamento" },
    { key: "preferencia", type: "text", label: "Preferencia" },
  ],
};

const DEMO_NAMES = [
  "Ana Souza",
  "Carlos Lima",
  "Mariana Alves",
  "Joao Pedro",
  "Fernanda Costa",
  "Rafael Dias",
  "Patricia Nunes",
  "Lucas Silva",
  "Bruna Melo",
  "Gustavo Rocha",
  "Beatriz Martins",
  "Thiago Fernandes",
];

const DEMO_TEMPERATURES: Temperature[] = ["quente", "morno", "frio"];

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function normalizeColumns(columns: KanbanColumnConfig[] | undefined): KanbanColumnConfig[] {
  if (!columns || columns.length === 0) {
    return DEFAULT_KANBAN_COLUMNS;
  }

  return [...columns].sort((a, b) => a.order - b.order);
}

function normalizeFollowConfig(followConfig: FollowConfig | undefined): FollowConfig {
  if (!followConfig || !followConfig.kanban?.columns?.length) {
    return DEFAULT_FOLLOW_CONFIG;
  }

  return {
    kanban: {
      columns: [...followConfig.kanban.columns].sort((a, b) => a.order - b.order),
    },
    business_hours: {
      ...followConfig.business_hours,
    },
  };
}

function buildDemoLeads(options?: DemoOptions): Lead[] {
  const tenantId = options?.tenantId ?? "demo-tenant";
  const kanbanColumns = normalizeColumns(options?.kanbanColumns);
  const followConfig = normalizeFollowConfig(options?.followConfig);
  const statusKeys = kanbanColumns.map((column) => column.key.toLowerCase());
  const followStages = followConfig.kanban.columns.map((column) => column.label);

  const leads: Lead[] = [];

  for (let index = 0; index < 18; index += 1) {
    const id = `demo-lead-${String(index + 1).padStart(2, "0")}`;
    const status = statusKeys[index % statusKeys.length] ?? "novo";
    const followStage = followStages[index % followStages.length] ?? null;
    const daysAgo = 1 + index;

    leads.push({
      id,
      tenant_id: tenantId,
      phone: `+55 11 9${String(1000 + index).padStart(4, "0")}-${String(2000 + index).padStart(4, "0")}`,
      name: DEMO_NAMES[index % DEMO_NAMES.length],
      email: `lead${index + 1}@demo.leguiard.com`,
      status_kanban: status,
      temperature: DEMO_TEMPERATURES[index % DEMO_TEMPERATURES.length],
      custom_data: {
        origem: index % 2 === 0 ? "Google Ads" : "Instagram",
        orcamento: 2000 + index * 350,
        preferencia: index % 3 === 0 ? "Atendimento rapido" : "Comparando opcoes",
      },
      ai_summary: "Lead ficticio para demonstracao do ambiente de producao.",
      ai_active: index % 4 !== 0,
      not_a_lead: false,
      last_interaction: toIsoDateDaysAgo(index % 7),
      created_at: toIsoDateDaysAgo(daysAgo),
      ai_run_count: 1 + (index % 5),
      history_sync_needed: false,
      conv_id: index % 2 === 0 ? `conv-demo-${index + 1}` : null,
      follow_stage: followStage,
    });
  }

  return leads;
}

function buildDemoInteractions(leadId: string): Interaction[] {
  const base = leadId.replace("demo-lead-", "");
  return [
    {
      id: `demo-int-${base}-1`,
      lead_id: leadId,
      role: "user",
      content: "Oi, quero saber mais detalhes sobre o servico.",
      created_at: toIsoDateDaysAgo(2),
    },
    {
      id: `demo-int-${base}-2`,
      lead_id: leadId,
      role: "assistant",
      content: "Perfeito! Posso te mostrar os planos e prazos de implantacao.",
      created_at: toIsoDateDaysAgo(1),
    },
    {
      id: `demo-int-${base}-3`,
      lead_id: leadId,
      role: "user",
      content: "Quero agendar uma reuniao para fechar os proximos passos.",
      created_at: toIsoDateDaysAgo(0),
    },
  ];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildSeries(days = 30, base = 5, variance = 4): { date: string; count: number }[] {
  const result: { date: string; count: number }[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * DAY_MS).toISOString().split("T")[0];
    const wave = Math.sin(i / 3) * variance;
    const count = Math.max(0, Math.round(base + wave + (i % 3)));
    result.push({ date, count });
  }

  return result;
}

export function getDemoFollowConfig(options?: DemoOptions): FollowConfig {
  return clone(normalizeFollowConfig(options?.followConfig));
}

export function getDemoLeads(options?: DemoOptions): Lead[] {
  return clone(buildDemoLeads(options));
}

export function getDemoLeadsResponse(
  searchParams: URLSearchParams,
  options?: DemoOptions
): {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} {
  const all = buildDemoLeads(options);
  const status = searchParams.get("status")?.toLowerCase();
  const temperature = searchParams.get("temperature")?.toLowerCase();
  const aiActive = searchParams.get("ai_active");
  const notALead = searchParams.get("not_a_lead");
  const search = searchParams.get("search")?.toLowerCase();
  const pageRaw = Number.parseInt(searchParams.get("page") || "1", 10);
  const limitRaw = Number.parseInt(searchParams.get("limit") || "50", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

  let filtered = all;

  if (status) {
    filtered = filtered.filter((lead) => lead.status_kanban?.toLowerCase() === status);
  }

  if (temperature) {
    filtered = filtered.filter((lead) => lead.temperature?.toLowerCase() === temperature);
  }

  if (aiActive === "true" || aiActive === "false") {
    const expected = aiActive === "true";
    filtered = filtered.filter((lead) => Boolean(lead.ai_active) === expected);
  }

  if (notALead === "true" || notALead === "false") {
    const expected = notALead === "true";
    filtered = filtered.filter((lead) => Boolean(lead.not_a_lead) === expected);
  }

  if (search) {
    filtered = filtered.filter((lead) => {
      const name = lead.name?.toLowerCase() ?? "";
      const phone = lead.phone?.toLowerCase() ?? "";
      return name.includes(search) || phone.includes(search);
    });
  }

  const from = (page - 1) * limit;
  const to = from + limit;
  const pageItems = filtered.slice(from, to);

  return {
    leads: clone(pageItems),
    total: filtered.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
  };
}

export function getDemoLeadById(leadId: string, options?: DemoOptions): Lead | null {
  const lead = buildDemoLeads(options).find((item) => item.id === leadId);
  return lead ? clone(lead) : null;
}

export function getDemoLeadDetailPayload(
  leadId: string,
  options?: DemoOptions
): {
  lead: Lead | null;
  interactions: Interaction[];
  crmConfig: CrmConfig | null;
  kanbanConfig: { columns: KanbanColumnConfig[] } | null;
} {
  const lead = getDemoLeadById(leadId, options);
  if (!lead) {
    return {
      lead: null,
      interactions: [],
      crmConfig: clone(DEMO_CRM_CONFIG),
      kanbanConfig: {
        columns: clone(normalizeColumns(options?.kanbanColumns)),
      },
    };
  }

  return {
    lead,
    interactions: buildDemoInteractions(leadId),
    crmConfig: clone(DEMO_CRM_CONFIG),
    kanbanConfig: {
      columns: clone(normalizeColumns(options?.kanbanColumns)),
    },
  };
}

export function getDemoDashboardMetrics(options?: DemoOptions): DashboardMetrics {
  const leads = buildDemoLeads(options);
  const kanbanColumns = normalizeColumns(options?.kanbanColumns);
  const followConfig = normalizeFollowConfig(options?.followConfig);
  const leadsPerDay = buildSeries(30, 7, 3);
  const conversationsPerDay = buildSeries(30, 5, 2);
  const messagesPerDay = buildSeries(30, 16, 5);

  const kanbanCountMap = new Map<string, number>();
  for (const column of kanbanColumns) {
    kanbanCountMap.set(column.key.toLowerCase(), 0);
  }

  for (const lead of leads) {
    const key = lead.status_kanban?.toLowerCase() || "";
    kanbanCountMap.set(key, (kanbanCountMap.get(key) || 0) + 1);
  }

  const kanbanFunnel = kanbanColumns.map((column) => ({
    key: column.key,
    label: column.label,
    count: kanbanCountMap.get(column.key.toLowerCase()) || 0,
    color: column.color,
    order: column.order,
  }));

  const followCountMap = new Map<string, number>();
  for (const stage of followConfig.kanban.columns) {
    followCountMap.set(stage.label, 0);
  }

  for (const lead of leads) {
    if (!lead.follow_stage) continue;
    followCountMap.set(lead.follow_stage, (followCountMap.get(lead.follow_stage) || 0) + 1);
  }

  const followupDistribution = followConfig.kanban.columns.map((stage) => ({
    stage: stage.label,
    count: followCountMap.get(stage.label) || 0,
    color: stage.color,
    order: stage.order,
  }));

  const first = kanbanFunnel[0]?.count ?? 0;
  const final = kanbanFunnel.find((item) => item.label.toLowerCase().includes("fechado"))?.count ?? 0;

  return {
    totalLeads: leads.length,
    newLeadsLast7Days: 9,
    newLeadsToday: 3,
    interactionsToday: 28,
    leadsStagnated: 4,
    stagnationThresholdDays: 3,
    funnelConversionRate: first > 0 ? Number(((final / first) * 100).toFixed(2)) : 0,
    kanbanFunnel,
    followupDistribution,
    leadsPerDay,
    conversationsPerDay,
    messagesPerDay,
    newSinceLastLogin: 6,
  };
}

export function getDemoTenantPayload(id: string, options?: DemoOptions): Tenant {
  const followConfig = normalizeFollowConfig(options?.followConfig);
  const kanbanColumns = normalizeColumns(options?.kanbanColumns);

  return {
    id,
    name: options?.tenantName ?? "Demo Company",
    description: "Ambiente ficticio para apresentacao comercial",
    crm_config: clone(DEMO_CRM_CONFIG),
    kanban_config: {
      columns: clone(kanbanColumns),
    },
    ai_config_followup: {
      model: "gpt-4o-mini",
      temperature: 0.2,
      instructions: "Configuracao ficticia para demonstracao.",
    },
    follow_config: clone(followConfig),
    follow_status: true,
    plan_level: "gold",
  };
}
