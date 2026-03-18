"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-provider";
import type { Lead, StatusKanban } from "@/types/database";
import {
  getKanbanColumns,
  TEMPERATURE_LABELS,
  TEMPERATURE_COLORS,
} from "@/types/database";
import { ImpactWarningDialog } from "@/components/shared/impact-warning-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createLeaderTabCoordinator } from "@/lib/realtime/leader-tab";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getJsonWithDedupe } from "@/lib/utils/client-get-cache";

type KanbanClientProps = {
  initialLeads: Lead[];
  initialTenantId: string | null;
};

export default function KanbanClient({
  initialLeads,
  initialTenantId,
}: KanbanClientProps) {
  const router = useRouter();
  const { selectedTenant, loading: tenantLoading } = useTenant();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [loading, setLoading] = useState(!initialTenantId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    leadId: string;
    newStatus: StatusKanban;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const realtimeHealthyRef = useRef(false);
  const leadsFetchInFlightRef = useRef(false);
  const lastSilentSyncAtRef = useRef(0);
  // removed: lastLoginAt feature

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    router.prefetch("/conversations");
  }, [router]);

  const fetchLeads = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!selectedTenant) return;
    const showLoading = options?.showLoading ?? false;
    const now = Date.now();

    if (!showLoading) {
      if (leadsFetchInFlightRef.current) {
        return;
      }

      if (now - lastSilentSyncAtRef.current < 60000) {
        return;
      }
    }

    leadsFetchInFlightRef.current = true;
    if (showLoading) {
      setLoading(true);
    }

    try {
      const data = await getJsonWithDedupe<{ leads?: Lead[] }>(
        `/api/leads?tenant_id=${selectedTenant.id}&limit=300&lite=true`,
        { cacheMs: 4000 }
      );
      setLeads((data.leads as Lead[]) ?? []);
      if (!showLoading) {
        lastSilentSyncAtRef.current = Date.now();
      }
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    } finally {
      leadsFetchInFlightRef.current = false;
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [selectedTenant]);

  useEffect(() => {
    if (
      selectedTenant &&
      initialTenantId &&
      selectedTenant.id === initialTenantId
    ) {
      setLeads(initialLeads);
      setLoading(false);
      if (initialLeads.length < 300) {
        void fetchLeads({ showLoading: false });
      }
      return;
    }

    void fetchLeads({ showLoading: true });
  }, [fetchLeads, initialLeads, initialTenantId, selectedTenant]);

  useEffect(() => {
    if (!selectedTenant) return;

    const supabase = createClient();
    const channelTopic = `kanban-leads-${selectedTenant.id}-${Math.random().toString(36).slice(2)}`;
    const coordinator = createLeaderTabCoordinator(`kanban:${selectedTenant.id}`);
    const syncTimer = window.setInterval(() => {
      if (!document.hidden && !realtimeHealthyRef.current && coordinator.shouldRun()) {
        void fetchLeads({ showLoading: false });
      }
    }, 60000);

    const channel = supabase
      .channel(channelTopic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const payloadTenantId =
            (payload.new as { tenant_id?: string } | null)?.tenant_id ??
            (payload.old as { tenant_id?: string } | null)?.tenant_id;

          if (!payloadTenantId) {
            return;
          }

          if (String(payloadTenantId) !== selectedTenant.id) {
            return;
          }

          if (payload.eventType === "DELETE") {
            const oldLead = payload.old as { id?: string };
            if (!oldLead.id) return;
            setLeads((prev) => prev.filter((lead) => lead.id !== oldLead.id));
            return;
          }

          const incoming = payload.new as unknown as Lead;
          if (!incoming?.id) return;

          const normalizedLead: Lead = {
            ...incoming,
            status_kanban: incoming.status_kanban
              ? String(incoming.status_kanban).toLowerCase()
              : incoming.status_kanban,
          };

          setLeads((prev) => {
            const index = prev.findIndex((lead) => lead.id === normalizedLead.id);
            if (index === -1) {
              return [normalizedLead, ...prev];
            }

            const next = [...prev];
            next[index] = { ...next[index], ...normalizedLead };
            return next;
          });
        }
      )
      .subscribe((status: string, error?: Error) => {
        if (status === "SUBSCRIBED") {
          realtimeHealthyRef.current = true;
          return;
        }

        if (status === "CLOSED") {
          realtimeHealthyRef.current = false;
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          realtimeHealthyRef.current = false;
          console.warn("Realtime kanban instavel:", status, error?.message || error || "sem detalhe");
        }
      });

    return () => {
      realtimeHealthyRef.current = false;
      coordinator.release();
      window.clearInterval(syncTimer);
      void supabase.removeChannel(channel);
    };
  }, [fetchLeads, selectedTenant]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as StatusKanban;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status_kanban === newStatus) return;

    // Abrir aviso antes de mover
    setPendingMove({ leadId, newStatus });
    setWarningOpen(true);
  }

  async function confirmMove() {
    if (!pendingMove) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/leads/${pendingMove.leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_kanban: pendingMove.newStatus }),
      });

      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === pendingMove.leadId
              ? { ...l, status_kanban: pendingMove.newStatus }
              : l
          )
        );
        toast.success("Lead movido com sucesso!");
      } else {
        toast.error("Erro ao mover lead.");
      }
    } catch {
      toast.error("Erro ao salvar alteração.");
    } finally {
      setSaving(false);
      setWarningOpen(false);
      setPendingMove(null);
    }
  }

  const activeLead = leads.find((l) => l.id === activeId);

  if (tenantLoading || loading) {
    return <KanbanSkeleton />;
  }

  if (!selectedTenant) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">
          Nenhuma empresa disponível.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold sm:text-2xl">Kanban</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Visualize e gerencie o pipeline de {selectedTenant.name}
        </p>
      </div>

      <ScrollArea className="w-full">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 pb-4" style={{ minWidth: "fit-content" }}>
            {getKanbanColumns(selectedTenant).map((column) => {
              const columnLeads = leads.filter(
                (l) => l.status_kanban === column.key
              );

              return (
                <KanbanColumn
                  key={column.key}
                  id={column.key}
                  title={column.label}
                  count={columnLeads.length}
                  color={column.color}
                >
                  {columnLeads.map((lead) => (
                    <KanbanCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => router.push(`/conversations?lead=${lead.id}`)}
                    />
                  ))}
                </KanbanColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeLead ? (
              <Card className="w-[85vw] max-w-72 rotate-2 border-primary/30 opacity-95 ring-2 ring-primary/20 shadow-2xl sm:w-72">
                <CardContent className="p-3">
                  <p className="font-semibold text-sm">
                    {activeLead.name || "Sem nome"}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {activeLead.phone}
                  </p>
                  {activeLead.temperature && (
                    <Badge
                      className={`mt-2 ${
                        TEMPERATURE_COLORS[activeLead.temperature]
                      } text-white text-xs shadow-sm`}
                    >
                      {TEMPERATURE_LABELS[activeLead.temperature]}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <ImpactWarningDialog
        open={warningOpen}
        onOpenChange={setWarningOpen}
        onConfirm={confirmMove}
        loading={saving}
        fieldName="Status do Kanban"
      />
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <div className="flex gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex w-[85vw] max-w-72 shrink-0 flex-col gap-2.5 rounded-xl border bg-muted/20 p-2 pt-4 sm:w-72">
            <div className="flex items-center justify-between px-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
              <Skeleton key={j} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
