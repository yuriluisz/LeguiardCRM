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

## Performance (execucao por fases)

### Fase 0 - Baseline

Use o checklist em:

- `docs/performance/phase-0-baseline.md`

Roadmap completo:

- `docs/performance/roadmap.md`

### Fase 1 - Indices SQL

Aplicar no Supabase SQL Editor:

- `scripts/db/performance-indexes.sql`

Depois de aplicar os indices:

1. Rode 3 vezes o Lighthouse em aba anonima sem extensoes.
2. Compare mediana de `TTFB`, `Speed Index` e `Main-thread work`.
3. Validar os smoke checks descritos no checklist da Fase 0.

## Backup e Restore (100% logico)

Para backup fiel da estrutura + dados, use `pg_dump/pg_restore` (nao apenas SQL de introspeccao).

### Pre-requisitos

- PostgreSQL client tools no PATH (`pg_dump`, `pg_restore`, `psql`)
- URL direta do banco (recomendado, evitando pooler quando possivel)
- Variavel de ambiente:

```bash
SUPABASE_DB_URL=postgresql://...
SUPABASE_RESTORE_DB_URL=postgresql://... # opcional
```

### Gerar backup

```powershell
pwsh ./scripts/db/backup-full.ps1
```

O script gera em `backups/db-YYYYMMDD-HHMMSS`:

- `full.dump` (backup principal)
- `schema.sql` (schema legivel)
- `globals.sql` (roles/tablespaces, quando permitido)
- `manifest.txt` com hashes SHA256

### Restaurar backup

```powershell
pwsh ./scripts/db/restore-full.ps1 -BackupDir "backups/db-YYYYMMDD-HHMMSS"
```

Opcoes uteis:

- `-NoOwner` para restaurar sem ownership
- `-SkipGlobals` para ignorar restore de roles/tablespaces

### Validar restore

```powershell
psql "$env:SUPABASE_RESTORE_DB_URL" -f ./scripts/db/verify-backup.sql
```
