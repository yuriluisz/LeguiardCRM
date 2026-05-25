# Leguiard CRM

> **CRM de alto desempenho com IA autônoma para vendas via WhatsApp.**
> Transforme cliques em faturamento com qualificação automática, negociação inteligente e rastreamento ponta a ponta.

**Produção:** [crm.leguiard.com](https://crm.leguiard.com) &nbsp;|&nbsp; **Site institucional:** [leguiard.com](https://leguiard.com)

---

## Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Stack Tecnológica](#stack-tecnológica)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Modelo de Dados](#modelo-de-dados)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Configuração](#instalação-e-configuração)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Fluxo de Autenticação](#fluxo-de-autenticação)
- [Sistema de Kanban Dinâmico](#sistema-de-kanban-dinâmico)
- [Sistema de Follow-up](#sistema-de-follow-up)
- [Dashboard Executivo](#dashboard-executivo)
- [Módulo de Conversas](#módulo-de-conversas)
- [Integração com o Ecossistema](#integração-com-o-ecossistema)
- [Convenções de Código](#convenções-de-código)
- [Licença](#licença)

---

## Visão Geral

O **Leguiard CRM** é a interface operacional que equipes comerciais usam diariamente para gerenciar leads, acompanhar conversas com IA, controlar o funil de vendas e tomar decisões baseadas em dados em tempo real.

Ele é parte de um ecossistema maior que inclui:

| Componente | Função |
|---|---|
| **Leguiard CRM** _(este repositório)_ | Interface operacional para vendedores e gestores |
| **TenantAdm** | Painel de administração multi-tenant (gestão de clientes, usuários, IA, monitoramento) |
| **n8n** | Motor de automação (workflows de IA, WhatsApp, follow-up) |
| **Supabase** | Banco de dados PostgreSQL, autenticação e realtime |

### Proposta de valor

- **Resposta instantânea** — IA autônoma responde leads em segundos via WhatsApp, eliminando o gargalo dos 5 minutos
- **Negociação inteligente** — Abordagem consultiva com argumentação proativa, não apenas "Como posso ajudar?"
- **Rastreamento ponta a ponta** — Do clique no Meta Ads até a comissão na conta
- **Previsibilidade de caixa** — Métricas de desempenho validadas para tomadas de decisão ágeis

---

## Funcionalidades

### 🎯 Dashboard Executivo
- Visão consolidada de métricas: total de leads, novos leads (hoje e últimos 7 dias), interações do dia
- Taxa de conversão do funil completo
- Distribuição de leads por etapa do kanban e por estágio de follow-up
- Gráficos de evolução temporal (leads/dia, conversas/dia, mensagens/dia)
- Indicador de leads estagnados com threshold configurável
- Contagem de novos leads desde o último login

### 📋 Kanban Operacional
- Pipeline visual drag-and-drop com colunas configuráveis por tenant
- Cores e labels customizáveis por etapa
- Identificação de etapas finais (Fechado, Perdido)
- Drag & drop entre colunas com `@dnd-kit`
- Atualização em tempo real via Supabase Realtime

### 💬 Módulo de Conversas
- Histórico completo de conversas entre IA e leads
- Visualização em formato de chat (role: `user` | `assistant`)
- Resumo automático gerado por IA (`ai_summary`)
- Acompanhamento do processo de qualificação e negociação

### 🔄 Sistema de Follow-up
- Pipeline de follow-up independente com estágios configuráveis
- Delays entre etapas configuráveis por hora
- Respeito a horário comercial (dias e horários)
- Kanban de follow-up visual separado

### 🌡️ Qualificação de Leads
- Classificação por temperatura: Frio 🔵 / Morno 🟡 / Quente 🔴
- Campos customizáveis por tenant (`crm_config.fields`)
- Flag `not_a_lead` para filtrar contatos irrelevantes
- Flag `ai_active` para controle de ativação da IA por lead
- Contagem de execuções da IA (`ai_run_count`)

### 🔐 Autenticação e Multi-tenancy
- Login via Supabase Auth
- Controle de acesso por tenant — cada usuário enxerga apenas seus tenants
- Middleware de sessão via proxy (SSR)
- Suporte a múltiplos tenants por usuário

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| **Framework** | Next.js | 16.1.6 |
| **Runtime** | React | 19.2.3 |
| **Linguagem** | TypeScript | 5.x |
| **Estilização** | Tailwind CSS | 4.x |
| **Componentes UI** | Radix UI + shadcn/ui | 1.4.3 |
| **Ícones** | Lucide React | 0.575.x |
| **Gráficos** | Recharts | 3.7.x |
| **Drag & Drop** | @dnd-kit | core 6.3 / sortable 10.x |
| **Backend/DB** | Supabase (PostgreSQL + Auth + Realtime) | SSR 0.8.x |
| **Data** | date-fns | 4.1.x |
| **Tema** | next-themes | 0.4.x |
| **Toasts** | Sonner | 2.0.x |

---

## Arquitetura do Sistema

```
                    ┌─────────────────────────┐
                    │      Meta Ads           │
                    │   (tráfego pago)        │
                    └──────────┬──────────────┘
                               │ clique
                               ▼
                    ┌─────────────────────────┐
                    │      WhatsApp           │
                    │  (lead inicia contato)  │
                    └──────────┬──────────────┘
                               │ webhook
                               ▼
                    ┌─────────────────────────┐
                    │        n8n              │
                    │  (workflows de IA)      │
                    │  - qualifica lead       │
                    │  - negocia via IA       │
                    │  - agenda reunião       │
                    │  - executa follow-up    │
                    └──────────┬──────────────┘
                               │ CRUD
                               ▼
              ┌────────────────────────────────────┐
              │           Supabase                 │
              │  ┌──────────┐  ┌───────────────┐   │
              │  │ PostgreSQL│  │   Auth        │   │
              │  │ (dados)  │  │ (sessões)     │   │
              │  └──────────┘  └───────────────┘   │
              │  ┌──────────────────────────────┐   │
              │  │        Realtime              │   │
              │  │  (subscriptions ao vivo)     │   │
              │  └──────────────────────────────┘   │
              └────────────┬───────────┬───────────┘
                           │           │
                ┌──────────▼──┐   ┌────▼──────────┐
                │ Leguiard CRM│   │   TenantAdm   │
                │  (operação) │   │  (governança)  │
                └─────────────┘   └───────────────┘
```

---

## Estrutura de Pastas

```
LeguiardCRM/
├── public/                     # Assets estáticos
├── src/
│   ├── app/
│   │   ├── (dashboard)/        # Rotas protegidas (layout com sidebar)
│   │   │   ├── conversations/  # Módulo de conversas com IA
│   │   │   ├── dashboard/      # Dashboard executivo com métricas
│   │   │   ├── followup/       # Pipeline de follow-up
│   │   │   ├── kanban/         # Kanban operacional drag-and-drop
│   │   │   └── layout.tsx      # Layout compartilhado (sidebar + header)
│   │   ├── api/
│   │   │   ├── dashboard/      # API de métricas consolidadas
│   │   │   ├── leads/          # CRUD de leads
│   │   │   ├── onboard/        # Onboarding de novos usuários
│   │   │   └── tenants/        # Consulta de tenants do usuário
│   │   ├── auth/               # Callbacks de autenticação Supabase
│   │   ├── login/              # Página de login
│   │   ├── globals.css         # Estilos globais + design tokens
│   │   ├── layout.tsx          # Layout raiz (providers, fonts)
│   │   └── page.tsx            # Rota raiz (redirect)
│   ├── components/
│   │   ├── dashboard/          # Componentes do dashboard (KPIs, gráficos)
│   │   ├── kanban/             # Componentes do kanban (colunas, cards)
│   │   ├── leads/              # Componentes de leads (tabela, detalhes)
│   │   ├── layout/             # Sidebar, header, navigation
│   │   ├── providers/          # Context providers (tenant, tema)
│   │   ├── shared/             # Componentes compartilhados
│   │   └── ui/                 # shadcn/ui primitives
│   ├── lib/
│   │   ├── auth/               # Helpers de autenticação
│   │   ├── conversations/      # Lógica de conversas
│   │   ├── dashboard/          # Queries de métricas
│   │   ├── followup/           # Lógica de follow-up
│   │   ├── leads/              # Queries e mutações de leads
│   │   ├── realtime/           # Subscriptions Supabase Realtime
│   │   ├── supabase/           # Cliente Supabase (server + client + middleware)
│   │   ├── tenants/            # Queries de tenant
│   │   ├── utils/              # Utilitários gerais
│   │   └── utils.ts            # cn() helper (tailwind-merge + clsx)
│   └── types/
│       └── database.ts         # Tipos TypeScript de todo o modelo de dados
├── .env.example                # Template de variáveis de ambiente
├── components.json             # Configuração shadcn/ui
├── next.config.ts              # Configuração Next.js
├── package.json                # Dependências e scripts
├── postcss.config.mjs          # PostCSS (Tailwind)
└── tsconfig.json               # Configuração TypeScript
```

---

## Modelo de Dados

### Entidades Principais

```typescript
// Tenant — representa um cliente (empresa) no sistema
interface Tenant {
  id: string;
  name: string;
  description: string | null;
  crm_config: CrmConfig | null;        // Campos customizáveis do CRM
  kanban_config: KanbanConfig | null;   // Pipeline de vendas dinâmico
  ai_config_followup: AiConfigFollowup | null;
  follow_config: FollowConfig | null;   // Configuração de follow-up
  follow_status: boolean | null;        // Follow-up ativado?
  plan_level: string | null;            // BRONZE | PRATA | OURO | DIAMANTE
}

// Lead — potencial cliente em negociação
interface Lead {
  id: string;
  tenant_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  status_kanban: string;              // Etapa dinâmica do pipeline
  temperature: "desconhecido" | "frio" | "morno" | "quente";
  custom_data: Record<string, unknown> | null;
  ai_summary: string | null;          // Resumo gerado pela IA
  ai_active: boolean;                 // IA ativa para este lead?
  not_a_lead: boolean;                // Marcado como não-lead
  ai_run_count: number;               // Quantas vezes a IA processou
  follow_stage: string | null;        // Etapa do follow-up
  conv_id: string | null;             // ID da conversa WhatsApp
  last_interaction: string | null;    // Timestamp da última interação
  created_at: string;
}

// Interaction — mensagem individual na conversa
interface Interaction {
  id: string;
  lead_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
```

### Kanban Dinâmico

Cada tenant pode ter seu próprio pipeline de vendas:

```typescript
interface KanbanColumnConfig {
  key: string;           // Identificador único (ex: "novo", "qualificado")
  label: string;         // Nome exibido (ex: "Novo", "Qualificado")
  order: number;         // Posição na sequência
  ai_description: string; // Descrição para a IA entender a etapa
  color?: string;        // Cor hex (ex: "#3b82f6")
  is_final?: boolean;    // Etapa final? (Fechado, Perdido)
}
```

**Colunas padrão:** Novo → Contato → Qualificado → Visita → Proposta → Fechado ✅ → Perdido ❌

---

## Pré-requisitos

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **Supabase** — Projeto configurado com as tabelas do schema
- Acesso ao **TenantAdm** para criação de tenants e usuários

---

## Instalação e Configuração

```bash
# 1. Clonar o repositório
git clone <url-do-repositorio>
cd LeguiardCRM

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas credenciais Supabase

# 4. Iniciar em modo desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Chave anon do Supabase (pública) |
| `SUPABASE_DB_URL` | ❌ | Connection string PostgreSQL direta (para backup/restore) |
| `SUPABASE_RESTORE_DB_URL` | ❌ | URL do banco de destino para restore |

> **⚠️ Importante:** Nunca commite o `.env.local` com valores reais. O `.env.example` serve como template.

---

## Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera a build de produção |
| `npm run start` | Inicia o servidor de produção |
| `npm run lint` | Executa o ESLint |

---

## Fluxo de Autenticação

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│  Login   │───▶│ Supabase Auth│───▶│  Middleware   │───▶│  Dashboard  │
│  Page    │    │  (email/pwd) │    │  (proxy.ts)  │    │  Protegido  │
└─────────┘    └──────────────┘    └──────────────┘    └─────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ Verifica     │
                                   │ crm_users +  │
                                   │ tenant_access│
                                   └──────────────┘
```

1. Usuário faz login com email e senha
2. Supabase Auth valida credenciais e retorna sessão
3. O middleware (`proxy.ts`) intercepta todas as rotas protegidas e atualiza a sessão
4. As API routes verificam se o usuário existe em `crm_users`, está ativo, e tem vínculo com tenants via `crm_user_tenants`
5. Dados são filtrados pelo `tenant_id` do usuário

---

## Sistema de Kanban Dinâmico

O kanban não é hardcoded — cada tenant configura seu próprio pipeline via `kanban_config`:

- **Helpers disponíveis:**
  - `getKanbanColumns(tenant)` — Retorna colunas ordenadas (ou default)
  - `getStatusLabel(tenant, key)` — Label legível de um status
  - `getStatusColor(tenant, key)` — Cor hex de um status
  - `isValidStatus(tenant, key)` — Valida se o status existe no pipeline

- **Fallback:** Se o tenant não tem `kanban_config`, o sistema usa `DEFAULT_KANBAN_COLUMNS` com 7 etapas padrão

---

## Sistema de Follow-up

O follow-up opera como um pipeline separado do kanban principal:

```typescript
interface FollowConfig {
  kanban: {
    columns: FollowKanbanColumnConfig[]; // Etapas com delay_hours
  };
  business_hours: {
    start: string;     // "08:00"
    end: string;       // "22:00"
    days: number[];    // [1,2,3,4,5] = seg-sex
    hora_diff: number; // Offset de timezone
  };
}
```

- Cada etapa tem um `delay_hours` configurável
- Mensagens só são enviadas dentro do horário comercial
- O `follow_status` do tenant controla se o follow-up está ativo

---

## Dashboard Executivo

O dashboard consolida métricas em tempo real:

| Métrica | Descrição |
|---|---|
| **Total de Leads** | Todos os leads do tenant |
| **Novos (7 dias)** | Leads criados nos últimos 7 dias |
| **Novos (hoje)** | Leads criados hoje |
| **Interações (hoje)** | Mensagens trocadas hoje |
| **Leads Estagnados** | Leads sem interação acima do threshold |
| **Taxa de Conversão** | % de leads que chegaram a etapa final positiva |
| **Funil Kanban** | Distribuição por etapa do pipeline |
| **Follow-up** | Distribuição por estágio de follow-up |
| **Séries Temporais** | Leads/dia, conversas/dia, mensagens/dia |

---

## Módulo de Conversas

Exibe as conversas reais entre a IA e os leads no WhatsApp:

- Layout em formato de chat com bolhas `user` (cliente) e `assistant` (IA)
- Resumo automático da conversa (`ai_summary`)
- Filtros por tenant, período e status
- Visibilidade do processo de qualificação e negociação

---

## Integração com o Ecossistema

```
┌───────────┐     cria tenants/usuários      ┌──────────┐
│ TenantAdm │ ──────────────────────────────▶ │ Supabase │
│ (admin)   │     configura IA/kanban         │   (DB)   │
└───────────┘                                 └────┬─────┘
                                                   │
      ┌─────────┐   processa leads/conversas  ┌────▼─────┐
      │   n8n   │ ◀──────────────────────────▶ │ Supabase │
      │ (auto.) │   grava interações           │   (DB)   │
      └─────────┘                              └────┬─────┘
                                                    │
                                              ┌─────▼──────┐
                                              │ Leguiard   │
                                              │    CRM     │
                                              │ (operação) │
                                              └────────────┘
```

- **TenantAdm → Supabase**: Cria tenants, configura pipeline, gerencia usuários e permissões
- **n8n → Supabase**: Processa mensagens WhatsApp, executa IA, grava leads e interações
- **CRM ← Supabase**: Lê dados em tempo real via Supabase Realtime para exibição operacional

---

## Convenções de Código

- **Componentes**: Client components usam sufixo `-client.tsx` (ex: `dashboard-client.tsx`)
- **Server Components**: Páginas `page.tsx` são server components que delegam para clientes
- **API Routes**: Seguem padrão Next.js App Router em `src/app/api/`
- **Tipos**: Centralizados em `src/types/database.ts`
- **Supabase**: Cliente separado para server (`createClient()`) e browser
- **Estilização**: Tailwind CSS v4 + shadcn/ui com design tokens em `globals.css`
- **Estado**: Sem store global — dados vêm do servidor e estado local com `useState`/`useEffect`

---

## Licença

Licença proprietária. Consulte o arquivo [LICENSE](./LICENSE) para detalhes.
