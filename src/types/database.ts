/** StatusKanban agora é dinâmico — qualquer string válida conforme kanban_config do tenant */
export type StatusKanban = string;

export type Temperature = "frio" | "morno" | "quente";

export type InteractionRole = "user" | "assistant";

export type CrmFieldType = "text" | "number" | "select" | "date";

// --- Kanban Config (dinâmico por tenant) ---

export interface KanbanColumnConfig {
  key: string;
  label: string;
  order: number;
  ai_description: string;
  color?: string;
  is_final?: boolean;
  followup?: {
    enabled: boolean;
    delay_hours: number;
    max_attempts: number;
    ai_prompt_hint?: string;
  };
}

export interface KanbanConfig {
  columns: KanbanColumnConfig[];
}

export interface AiConfigFollowup {
  model: string;
  temperature: number;
  instructions: string;
  // Legacy read fallback only. Do not persist as official field.
  system_prompt?: string;
}

export interface FollowKanbanColumnConfig {
  key: string;
  label: string;
  order: number;
  ai_description: string;
  color?: string;
  is_final?: boolean;
  delay_hours: number;
}

export interface FollowConfig {
  kanban: {
    columns: FollowKanbanColumnConfig[];
  };
  business_hours: {
    start: string;
    end: string;
    days: number[];
  };
}

export interface CrmField {
  key: string;
  type: CrmFieldType;
  label: string;
}

export interface CrmConfig {
  fields: CrmField[];
}

export interface Tenant {
  id: string;
  name: string;
  description: string | null;
  crm_config: CrmConfig | null;
  kanban_config: KanbanConfig | null;
  ai_config_followup: AiConfigFollowup | null;
  follow_config: FollowConfig | null;
  follow_status: boolean | null;
  plan_level: string | null;
}

export interface Lead {
  id: string;
  tenant_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  status_kanban: StatusKanban;
  temperature: Temperature | null;
  custom_data: Record<string, unknown> | null;
  ai_summary: string | null;
  ai_active: boolean;
  not_a_lead: boolean;
  last_interaction: string | null;
  created_at: string;
  ai_run_count: number;
  history_sync_needed: boolean;
  conv_id: string | null;
  follow_stage: string | null;
}

export interface Interaction {
  id: string;
  lead_id: string;
  role: InteractionRole;
  content: string;
  created_at: string;
}

export interface CrmUser {
  id: string;
  email: string;
  name: string | null;
  is_admin: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CrmUserTenant {
  id: string;
  crm_user_id: string;
  tenant_id: string;
  added_by: string | null;
  added_at: string;
}

// Dashboard metrics
export interface DashboardMetrics {
  totalLeads: number;
  newLeadsLast7Days: number;
  interactionsToday: number;
  leadsPerDay: { date: string; count: number }[];
  conversationsPerDay: { date: string; count: number }[];
  messagesPerDay: { date: string; count: number }[];
  newSinceLastLogin: number;
}

// Kanban column config — DEFAULT (fallback quando tenant não tem kanban_config)
export const DEFAULT_KANBAN_COLUMNS: KanbanColumnConfig[] = [
  { key: "novo", label: "Novo", order: 1, ai_description: "Lead acabou de chegar, sem nenhum contato realizado.", color: "#3b82f6" },
  { key: "contato", label: "Contato", order: 2, ai_description: "Lead já foi contactado pelo menos uma vez.", color: "#8b5cf6" },
  { key: "qualificado", label: "Qualificado", order: 3, ai_description: "Lead demonstrou interesse real.", color: "#06b6d4" },
  { key: "visita", label: "Visita", order: 4, ai_description: "Lead agendou ou confirmou visita/reunião.", color: "#f59e0b" },
  { key: "proposta", label: "Proposta", order: 5, ai_description: "Proposta comercial foi enviada ou discutida.", color: "#f97316" },
  { key: "fechado", label: "Fechado", order: 6, ai_description: "Negócio concluído com sucesso.", color: "#22c55e", is_final: true },
  { key: "perdido", label: "Perdido", order: 7, ai_description: "Lead desistiu ou não tem mais interesse.", color: "#ef4444", is_final: true },
];

export const DEFAULT_FOLLOWUP_COLUMNS: FollowKanbanColumnConfig[] = [
  {
    key: "follow-1",
    label: "Follow 1",
    order: 1,
    ai_description: "Primeira etapa de follow-up.",
    delay_hours: 24,
    color: "#3b82f6",
  },
  {
    key: "follow-final",
    label: "Final do Follow",
    order: 2,
    ai_description:
      "Etapa final de follow-up, encerra a sequencia e deixa canal aberto.",
    delay_hours: 24,
    color: "#22c55e",
    is_final: true,
  },
];

export const DEFAULT_FOLLOW_CONFIG: FollowConfig = {
  kanban: {
    columns: DEFAULT_FOLLOWUP_COLUMNS,
  },
  business_hours: {
    start: "08:00",
    end: "22:00",
    days: [1, 2, 3, 4, 5],
  },
};

/** @deprecated Use getKanbanColumns(tenant) */
export const KANBAN_COLUMNS: { key: string; label: string }[] = DEFAULT_KANBAN_COLUMNS.map(c => ({ key: c.key, label: c.label }));

/** @deprecated Use getStatusLabel(tenant, key) */
export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_KANBAN_COLUMNS.map(c => [c.key, c.label])
);

// --- Helpers para acessar config dinâmica ---

/** Retorna as colunas do kanban do tenant, ou o default */
export function getKanbanColumns(tenant: Tenant | null): KanbanColumnConfig[] {
  if (tenant?.kanban_config?.columns?.length) {
    return [...tenant.kanban_config.columns].sort((a, b) => a.order - b.order);
  }
  return DEFAULT_KANBAN_COLUMNS;
}

/** Retorna o label de um status baseado na config do tenant */
export function getStatusLabel(tenant: Tenant | null, key: string): string {
  const cols = getKanbanColumns(tenant);
  return cols.find(c => c.key === key)?.label ?? key;
}

/** Retorna a cor de um status baseado na config do tenant */
export function getStatusColor(tenant: Tenant | null, key: string): string {
  const cols = getKanbanColumns(tenant);
  return cols.find(c => c.key === key)?.color ?? "#6b7280";
}

/** Verifica se um status é válido para o tenant */
export function isValidStatus(tenant: Tenant | null, key: string): boolean {
  const cols = getKanbanColumns(tenant);
  return cols.some(c => c.key === key);
}

export const TEMPERATURE_LABELS: Record<string, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
};

export const TEMPERATURE_COLORS: Record<string, string> = {
  frio: "bg-blue-500",
  morno: "bg-yellow-500",
  quente: "bg-red-500",
};
