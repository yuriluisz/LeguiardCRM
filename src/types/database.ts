export type StatusKanban =
  | "novo"
  | "contato"
  | "qualificado"
  | "visita"
  | "proposta"
  | "fechado"
  | "perdido";

export type Temperature = "frio" | "morno" | "quente";

export type InteractionRole = "user" | "assistant";

export type CrmFieldType = "text" | "number" | "select" | "date";

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

// Kanban column config
export const KANBAN_COLUMNS: { key: StatusKanban; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "contato", label: "Contato" },
  { key: "qualificado", label: "Qualificado" },
  { key: "visita", label: "Visita" },
  { key: "proposta", label: "Proposta" },
  { key: "fechado", label: "Fechado" },
  { key: "perdido", label: "Perdido" },
];

export const STATUS_LABELS: Record<StatusKanban, string> = {
  novo: "Novo",
  contato: "Contato",
  qualificado: "Qualificado",
  visita: "Visita",
  proposta: "Proposta",
  fechado: "Fechado",
  perdido: "Perdido",
};

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
