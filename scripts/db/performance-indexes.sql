-- Performance indexes for dashboard and kanban queries
-- Apply in Supabase SQL Editor (safe with IF NOT EXISTS).

-- Leads: base tenant filters + created_at windows
create index if not exists idx_leads_tenant_created_at
  on public.leads (tenant_id, created_at desc);

-- Leads: interaction freshness checks
create index if not exists idx_leads_tenant_last_interaction
  on public.leads (tenant_id, last_interaction desc);

-- Leads: kanban funnel aggregation
create index if not exists idx_leads_tenant_status_kanban
  on public.leads (tenant_id, status_kanban);

-- Leads: follow-up distribution aggregation
create index if not exists idx_leads_tenant_follow_stage
  on public.leads (tenant_id, follow_stage);

-- Interactions: messages/day by lead and date
create index if not exists idx_interactions_lead_created_at
  on public.interactions (lead_id, created_at desc);

-- Optional helper index for status + inactivity checks in non-final stages.
create index if not exists idx_leads_tenant_status_last_interaction
  on public.leads (tenant_id, status_kanban, last_interaction desc);
