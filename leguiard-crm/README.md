# Leguiard CRM

CRM para acompanhamento em tempo real de leads gerenciados por agentes de IA no WhatsApp.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Supabase** (Auth + PostgreSQL + RLS)
- **Tailwind CSS 4** + **shadcn/ui**
- **Recharts** para gráficos
- **@dnd-kit** para drag-and-drop no Kanban

## Configuração

1. Clone o repositório
2. Instale as dependências:

```bash
npm install
```

3. Copie o arquivo de variáveis de ambiente:

```bash
cp .env.example .env.local
```

4. Configure as variáveis no `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
```

5. Rode o servidor de desenvolvimento:

```bash
npm run dev
```

## Estrutura de Páginas

| Rota | Descrição |
|------|-----------|
| `/` | Redirect → `/dashboard` |
| `/login` | Tela de login |
| `/auth/callback` | Exchange code (recovery) |
| `/auth/update-password` | Atualizar senha |
| `/dashboard` | Métricas e gráficos |
| `/leads` | Lista de leads com filtros |
| `/leads/[id]` | Detalhe do lead (chat + sidebar) |
| `/kanban` | Kanban board com drag-and-drop |

## API Routes

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/tenants` | Listar tenants do usuário |
| GET | `/api/leads` | Listar leads (com filtros) |
| GET | `/api/leads/[id]` | Detalhe do lead + interações |
| PATCH | `/api/leads/[id]` | Editar lead (status, ai_active, not_a_lead) |
| GET | `/api/dashboard` | Métricas agregadas |

## Deploy

Build para produção:

```bash
npm run build
npm start
```

O projeto é deployado em VPS com Node.js via EasyPanel.
