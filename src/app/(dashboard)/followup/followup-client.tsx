"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-provider";
import type {
  FollowConfig,
  FollowKanbanColumnConfig,
  Lead,
  Tenant,
} from "@/types/database";
import { DEFAULT_FOLLOW_CONFIG } from "@/types/database";
import { sanitizeFollowConfig } from "@/lib/followup/kanban-injection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DropAnimation,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Loader2,
  Plus,
  Settings2,
  Pencil,
  Trash2,
  Save,
  Clock3,
  MoreVertical,
  Palette,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getJsonWithDedupe } from "@/lib/utils/client-get-cache";

const DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
];

const PRESET_COLORS = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#f59e0b", // amber-500
  "#eab308", // yellow-500
  "#84cc16", // lime-500
  "#22c55e", // green-500
  "#10b981", // emerald-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#0ea5e9", // sky-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#a855f7", // purple-500
  "#d946ef", // fuchsia-500
  "#ec4899", // pink-500
  "#f43f5e", // rose-500
  "#64748b", // slate-500
];

const TZ_LABEL = "America/Cuiaba";

type UiFollowColumn = FollowKanbanColumnConfig & {
  _uiId: string;
};

type StageDraft = {
  label: string;
  ai_description: string;
  delay_hours: number;
  is_final: boolean;
  color: string;
};

function normalizeStageKey(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function withUi(columns: FollowKanbanColumnConfig[]): UiFollowColumn[] {
  return columns
    .sort((a, b) => a.order - b.order)
    .map((col) => ({
      ...col,
      _uiId: crypto.randomUUID(),
    }));
}

function toPersisted(columns: UiFollowColumn[]): FollowKanbanColumnConfig[] {
  const ordered = [...columns];
  return ordered.map((col, index) => ({
    key: col.key,
    label: col.label,
    order: index + 1,
    ai_description: col.ai_description,
    color: col.color,
    is_final: Boolean(col.is_final),
    delay_hours: Number(col.delay_hours ?? 0),
  }));
}

function enforceSingleFinal(columns: UiFollowColumn[]): UiFollowColumn[] {
  const sorted = [...columns];
  let found = false;

  const next = sorted.map((col) => {
    if (col.is_final && !found) {
      found = true;
      return col;
    }
    if (col.is_final && found) {
      return { ...col, is_final: false };
    }
    return col;
  });

  return next;
}


const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.5",
      },
    },
  }),
};

function SortableStageColumn({
  column,
  count,
  leads = [],
  onLeadClick,
  onEdit,
  onDelete,
  dragOverlay = false, // Add dragOverlay prop
}: {
  column: UiFollowColumn;
  count: number;
  leads?: Lead[];
  onLeadClick?: (leadId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  dragOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column._uiId });

  const style = {
    // Uses translate3d for better performance
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (dragOverlay) {
      return (
        <div
            className={cn(
          "z-50 flex w-[85vw] max-w-72 shrink-0 rotate-2 cursor-grabbing flex-col rounded-xl border bg-muted/20 shadow-2xl ring-2 ring-primary sm:w-72",
            )}
        >
        {/* Header "Janela" com Drag Handle */}
        <div className="group relative flex flex-col rounded-t-xl border-b bg-muted/40">
            {/* Barra superior colorida */}
            <div
            className="h-2 w-full rounded-t-xl"
            style={{ backgroundColor: column.color || "#6b7280" }}
            />

            {/* Conteúdo do Header */}
            <div className="flex items-center justify-between px-3 py-2">
            {/* Título e Info */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: column.color || "#6b7280" }}
                />
                <h3 className="truncate text-sm font-semibold leading-none">
                    {column.label}
                </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                <Clock3 className="h-3 w-3" />
                <span>Delay {column.delay_hours}h</span>
                </div>
            </div>

            {/* Ações (botão desativado no overlay) */}
             <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </div>
        </div>

        {/* Corpo da Coluna */}
        <div className="flex flex-1 flex-col p-3 space-y-3">
            <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Leads na etapa</span>
            <Badge
                variant="secondary"
                className="h-5 min-w-5 justify-center px-1.5 font-mono text-[10px]"
            >
                {count}
            </Badge>
            </div>

            {column.is_final && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Etapa Final do Fluxo
            </div>
            )}
        </div>
        </div>
      );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex w-[85vw] max-w-72 shrink-0 flex-col rounded-xl border bg-muted/20 transition-all duration-200 sm:w-72",
        isDragging && "opacity-30" // Lower opacity for the placeholder
      )}
    >
      {/* Header "Janela" com Drag Handle */}
      <div
        className="group relative flex flex-col rounded-t-xl border-b bg-muted/40"
        {...attributes}
        {...listeners}
      >
        {/* Barra superior colorida (Drag Handle principal) */}
        <div
          className="h-2 w-full cursor-grab rounded-t-xl active:cursor-grabbing"
          style={{ backgroundColor: column.color || "#6b7280" }}
        />

        {/* Conteúdo do Header */}
        <div className="flex items-center justify-between px-3 py-2">
          {/* Título e Info */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: column.color || "#6b7280" }}
              />
              <h3 className="truncate text-sm font-semibold leading-none">
                {column.label}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
              <Clock3 className="h-3 w-3" />
              <span>Delay {column.delay_hours}h</span>
            </div>
          </div>

          {/* Ações */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Corpo da Coluna */}
      <div className="flex flex-1 flex-col p-3 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Leads na etapa</span>
          <Badge
            variant="secondary"
            className="h-5 min-w-5 justify-center px-1.5 font-mono text-[10px]"
          >
            {count}
          </Badge>
        </div>

        {column.is_final && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Etapa Final do Fluxo
          </div>
        )}

        {!dragOverlay && (
          <div className="space-y-2">
            {leads.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum lead nesta etapa.
              </p>
            ) : (
              leads.map((lead) => (
                <Card
                  key={lead.id}
                  className="cursor-pointer border-border/50 bg-card transition-all duration-150 hover:shadow-md hover:border-border"
                  onClick={() => onLeadClick?.(lead.id)}
                >
                  <CardContent className="space-y-1.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {lead.name || "Sem nome"}
                      </p>
                      {lead.ai_active && (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                          <Bot className="h-3 w-3 text-green-500" />
                        </div>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {lead.phone}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type FollowupClientProps = {
  initialTenantId: string | null;
  initialLeads: Lead[];
  initialFollowStatus: boolean;
  initialFollowConfig: FollowConfig;
};

export default function FollowupClient({
  initialTenantId,
  initialLeads,
  initialFollowStatus,
  initialFollowConfig,
}: FollowupClientProps) {
  const router = useRouter();
  const { selectedTenant, loading: tenantLoading, demoMode } = useTenant();
  const isBronzeTenant = String(selectedTenant?.plan_level || "").toLowerCase() === "bronze";

  const [loading, setLoading] = useState(!initialTenantId);
  const [saving, setSaving] = useState(false);
  const [followStatus, setFollowStatus] = useState(initialFollowStatus);
  const [columns, setColumns] = useState<UiFollowColumn[]>(
    withUi(sanitizeFollowConfig(initialFollowConfig).kanban.columns)
  );
  const [businessHours, setBusinessHours] = useState<FollowConfig["business_hours"]>({
    ...sanitizeFollowConfig(initialFollowConfig).business_hours,
  });

  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingStageUiId, setEditingStageUiId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StageDraft>({
    label: "",
    ai_description: "",
    delay_hours: 24,
    is_final: false,
    color: "#3b82f6",
  });

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    router.prefetch("/conversations");
  }, [router]);

  useEffect(() => {
    if (!tenantLoading && isBronzeTenant) {
      toast.error("Follow-up indisponível no plano Bronze.");
      router.replace("/dashboard");
    }
  }, [isBronzeTenant, router, tenantLoading]);

  const activeColumn = useMemo(() => {
    if (!activeId) return null;
    return columns.find((c) => c._uiId === activeId);
  }, [activeId, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const stageCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of leads) {
      const stageKey = normalizeStageKey(lead.follow_stage);
      if (!stageKey) continue;
      map.set(stageKey, (map.get(stageKey) ?? 0) + 1);
    }
    return map;
  }, [leads]);

  const stageLeadsMap = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const lead of leads) {
      const stageKey = normalizeStageKey(lead.follow_stage);
      if (!stageKey) continue;
      const bucket = map.get(stageKey);
      if (bucket) {
        bucket.push(lead);
      } else {
        map.set(stageKey, [lead]);
      }
    }
    return map;
  }, [leads]);

  const loadTenant = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!selectedTenant) return;

    const showLoading = options?.showLoading ?? true;

    if (showLoading) {
      setLoading(true);
    }
    try {
      const [tenantRes, leadsPayload] = await Promise.all([
        fetch(`/api/tenants/${selectedTenant.id}`),
        getJsonWithDedupe<{ leads?: Lead[] }>(
          `/api/leads?tenant_id=${selectedTenant.id}&limit=300&lite=true`,
          { cacheMs: 4000 }
        ).catch(() => null),
      ]);

      if (!tenantRes.ok) {
        if (tenantRes.status === 401) throw new Error("Sessão expirada. Faça login novamente.");
        if (tenantRes.status === 403) throw new Error("Você não tem acesso a este tenant.");
        throw new Error("Falha ao carregar configurações de follow-up.");
      }

      const tenant = (await tenantRes.json()) as Tenant;
      const safeConfig = sanitizeFollowConfig(
        (tenant.follow_config as FollowConfig | null) ?? DEFAULT_FOLLOW_CONFIG
      );

      setFollowStatus(Boolean(tenant.follow_status));
      setColumns(withUi(safeConfig.kanban.columns));
      setBusinessHours(safeConfig.business_hours);

      if (leadsPayload) {
        setLeads((leadsPayload.leads as Lead[]) ?? []);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao carregar follow-up");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [selectedTenant]);

  useEffect(() => {
    if (!selectedTenant) return;

    if (initialTenantId && selectedTenant.id === initialTenantId) {
      setLoading(false);
      if (initialLeads.length < 300) {
        void loadTenant({ showLoading: false });
      }
      return;
    }

    void loadTenant();
  }, [initialLeads.length, initialTenantId, loadTenant, selectedTenant]);

  function openCreateStage() {
    if (demoMode) {
      toast.info("Modo Demo ativo: alteracoes estao bloqueadas.");
      return;
    }

    setEditingStageUiId(null);
    setDraft({
      label: "",
      ai_description: "",
      delay_hours: 24,
      is_final: false,
      color: "#3b82f6",
    });
    setStageDialogOpen(true);
  }

  function openEditStage(col: UiFollowColumn) {
    if (demoMode) {
      toast.info("Modo Demo ativo: alteracoes estao bloqueadas.");
      return;
    }

    setEditingStageUiId(col._uiId);
    setDraft({
      label: col.label,
      ai_description: col.ai_description,
      delay_hours: col.delay_hours,
      is_final: Boolean(col.is_final),
      color: col.color || "#3b82f6",
    });
    setStageDialogOpen(true);
  }

  function upsertStage() {
    if (demoMode) {
      toast.info("Modo Demo ativo: alteracoes estao bloqueadas.");
      return;
    }

    const cleanLabel = draft.label.trim();
    if (!cleanLabel) {
      toast.error("Nome da etapa é obrigatório.");
      return;
    }

    if (!Number.isFinite(Number(draft.delay_hours)) || Number(draft.delay_hours) < 0) {
      toast.error("Delay deve ser um número maior ou igual a zero.");
      return;
    }

    if (editingStageUiId) {
      setColumns((prev) => {
        const next = prev.map((col) => {
          if (col._uiId !== editingStageUiId) return col;
          return {
            ...col,
            label: cleanLabel,
            ai_description: draft.ai_description.trim(),
            delay_hours: Number(draft.delay_hours),
            is_final: draft.is_final,
            color: draft.color,
          };
        });

        if (draft.is_final) {
          return next.map((col) => ({ ...col, is_final: col._uiId === editingStageUiId }));
        }

        return enforceSingleFinal(next);
      });
    } else {
      setColumns((prev) => {
        const baseSlug = slugify(cleanLabel) || `etapa-${prev.length + 1}`;
        let key = baseSlug;
        const keys = new Set(prev.map((c) => c.key));
        let i = 1;
        while (keys.has(key)) {
          i += 1;
          key = `${baseSlug}-${i}`;
        }

        const next = [
          ...prev,
          {
            key,
            label: cleanLabel,
            order: prev.length + 1,
            ai_description: draft.ai_description.trim(),
            color: draft.color,
            is_final: draft.is_final,
            delay_hours: Number(draft.delay_hours),
            _uiId: crypto.randomUUID(),
          },
        ];

        if (draft.is_final) {
          const lastId = next[next.length - 1]._uiId;
          return next.map((c) => ({ ...c, is_final: c._uiId === lastId }));
        }

        return enforceSingleFinal(next);
      });
    }

    setStageDialogOpen(false);
  }

  function removeStage(stage: UiFollowColumn) {
    if (demoMode) {
      toast.info("Modo Demo ativo: alteracoes estao bloqueadas.");
      return;
    }

    const leadsInStage = stageCountMap.get(stage.label) ?? 0;
    if (leadsInStage > 0) {
      toast.error("Não é possível excluir etapa com leads vinculados.");
      return;
    }

    setColumns((prev) => {
      if (prev.length <= 2) {
        toast.error("É obrigatório manter ao menos 2 etapas.");
        return prev;
      }

      const sorted = [...prev];
      const index = sorted.findIndex((c) => c._uiId === stage._uiId);
      if (index < 0) return prev;

      const removed = sorted[index];
      const next = sorted.filter((c) => c._uiId !== stage._uiId);

      if (removed.is_final && next.length > 0) {
        const previousIndex = Math.max(0, index - 1);
        const finalUiId = next[previousIndex]?._uiId ?? next[next.length - 1]._uiId;
        return next.map((col) => ({ ...col, is_final: col._uiId === finalUiId }));
      }

      return enforceSingleFinal(next);
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function onDragEnd(event: DragEndEvent) {
    if (demoMode) {
      setActiveId(null);
      toast.info("Modo Demo ativo: ordenacao bloqueada.");
      return;
    }

    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    setColumns((prev) => {
      const oldIndex = prev.findIndex((c) => c._uiId === active.id);
      const newIndex = prev.findIndex((c) => c._uiId === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function toggleDay(day: number) {
    if (demoMode) {
      toast.info("Modo Demo ativo: alteracoes estao bloqueadas.");
      return;
    }

    setBusinessHours((prev) => {
      const exists = prev.days.includes(day);
      const nextDays = exists
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day].sort((a, b) => a - b);
      return {
        ...prev,
        days: nextDays,
      };
    });
  }

  async function saveConfig() {
    if (!selectedTenant) return;
    if (demoMode) {
      toast.info("Modo Demo ativo: alteracoes estao bloqueadas.");
      return;
    }

    if (columns.length < 2) {
      toast.error("Você precisa manter no mínimo 2 etapas para salvar.");
      return;
    }

    if (businessHours.days.length === 0) {
      toast.error("Selecione pelo menos um dia permitido.");
      return;
    }

    const persistedConfig = sanitizeFollowConfig({
      kanban: {
        columns: toPersisted(enforceSingleFinal(columns)),
      },
      business_hours: businessHours,
    });

    setSaving(true);
    try {
      console.log("PAYLOAD_FOLLOW_CONFIG", JSON.stringify(persistedConfig, null, 2));

      const res = await fetch(`/api/tenants/${selectedTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follow_status: followStatus,
          follow_config: persistedConfig,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Sessão expirada. Faça login novamente.");
        }
        if (res.status === 403) {
          throw new Error("Você não tem permissão para editar este tenant.");
        }
        if (res.status === 409) {
          const payload = await res.json();
          throw new Error(payload.error || "Não foi possível salvar a configuração.");
        }

        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Erro ao salvar follow-up.");
      }

      toast.success("Configuração de follow-up salva com sucesso.");
      await loadTenant();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Falha ao salvar follow-up.");
    } finally {
      setSaving(false);
    }
  }

  if (tenantLoading || loading) {
    return (
      <div className="flex h-[calc(100dvh-6.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedTenant) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Selecione uma empresa para configurar o follow-up.
      </div>
    );
  }

  if (isBronzeTenant) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Follow-up</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Pipeline de follow-up de {selectedTenant.name}
          </p>
          {demoMode && (
            <p className="text-xs font-medium text-amber-600">
              Modo Demo ativo: configuracoes em somente leitura.
            </p>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 sm:w-auto sm:justify-start">
            <Label htmlFor="follow-status" className="text-sm">
              Follow-up ativo
            </Label>
            <Switch
              id="follow-status"
              checked={followStatus}
              onCheckedChange={setFollowStatus}
              disabled={demoMode}
            />
          </div>

          <Button variant="outline" onClick={() => setSheetOpen(true)} className="flex-1 sm:flex-none" disabled={demoMode}>
            <Settings2 className="mr-2 h-4 w-4" />
            Configuração geral
          </Button>

          <Button onClick={saveConfig} disabled={saving || demoMode} className="flex-1 sm:flex-none">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar alterações
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full">
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
          <SortableContext
            items={columns.map((c) => c._uiId)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-3 pb-4" style={{ minWidth: "fit-content" }}>
              {columns.map((column) => (
                <SortableStageColumn
                  key={column._uiId}
                  column={column}
                  count={stageCountMap.get(normalizeStageKey(column.label)) ?? 0}
                  leads={stageLeadsMap.get(normalizeStageKey(column.label)) ?? []}
                  onLeadClick={(leadId) => router.push(`/conversations?lead=${leadId}`)}
                  onEdit={() => openEditStage(column)}
                  onDelete={() => removeStage(column)}
                />
              ))}

              <button
                type="button"
                onClick={openCreateStage}
                disabled={demoMode}
                className="flex h-[236px] w-[85vw] max-w-72 shrink-0 items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground sm:w-72"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova etapa
              </button>
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={dropAnimationConfig}>
            {activeColumn ? (
                <SortableStageColumn
                    column={activeColumn}
                  count={stageCountMap.get(normalizeStageKey(activeColumn.label)) ?? 0}
                    dragOverlay
                />
            ) : null}
          </DragOverlay>
        </DndContext>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStageUiId ? "Editar etapa" : "Nova etapa de follow-up"}
            </DialogTitle>
            <DialogDescription>
              Configure nome, descrição e delay desta etapa no fluxo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="stage-label">Nome da etapa</Label>
              <Input
                id="stage-label"
                value={draft.label}
                onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Ex: Follow 2"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stage-delay">Del da Etapa</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    id="stage-color"
                  >
                    <div
                      className="h-4 w-4 rounded-full border shadow-sm"
                      style={{ backgroundColor: draft.color || "#3b82f6" }}
                    />
                    <span className="text-muted-foreground font-normal">
                      {draft.color || "Selecione uma cor"}
                    </span>
                    <Palette className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(16rem,calc(100vw-2rem))] p-3" align="start">
                  <div className="grid grid-cols-6 gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          "h-8 w-8 rounded-full border transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                          draft.color === color &&
                            "ring-2 ring-primary ring-offset-2 scale-110 border-primary"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, color }))
                        }
                      />
                    ))}
                  </div>
                  <div className="mt-3 border-t pt-3">
                     <Label className="text-xs text-muted-foreground mb-1.5 block">Cor Personalizada</Label>
                     <div className="flex gap-2">
                        <Input
                          type="color"
                          value={draft.color}
                          onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
                          className="h-9 w-12 p-1 cursor-pointer"
                        />
                         <Input
                          value={draft.color}
                          onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
                          placeholder="#000000"
                          className="flex-1 font-mono text-xs"
                        />
                     </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stage-delay">Delay (horas)</Label>
              <Input
                id="stage-delay"
                type="number"
                min="0"
                value={draft.delay_hours}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, delay_hours: Number(e.target.value) }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stage-description">Descrição da etapa</Label>
              <Textarea
                id="stage-description"
                value={draft.ai_description}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, ai_description: e.target.value }))
                }
                placeholder="Descreva o comportamento esperado da IA nesta etapa"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="stage-final">Etapa final</Label>
              <Switch
                id="stage-final"
                checked={draft.is_final}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, is_final: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={upsertStage}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Configuração geral</SheetTitle>
            <SheetDescription>
              Defina janela e dias permitidos para os disparos do follow-up.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-time">Início</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={businessHours.start}
                  onChange={(e) =>
                    setBusinessHours((prev) => ({ ...prev, start: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-time">Fim</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={businessHours.end}
                  onChange={(e) =>
                    setBusinessHours((prev) => ({ ...prev, end: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias permitidos</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const active = businessHours.days.includes(day.value);
                  return (
                    <Button
                      key={day.value}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Timezone de referência: {TZ_LABEL}.
            </p>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Fechar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
