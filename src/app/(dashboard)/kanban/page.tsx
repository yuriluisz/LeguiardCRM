"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-provider";
import type { Lead, StatusKanban } from "@/types/database";
import {
  KANBAN_COLUMNS,
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

export default function KanbanPage() {
  const router = useRouter();
  const { selectedTenant, loading: tenantLoading } = useTenant();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    leadId: string;
    newStatus: StatusKanban;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  // removed: lastLoginAt feature

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchLeads = useCallback(async () => {
    if (!selectedTenant) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/leads?tenant_id=${selectedTenant.id}&limit=500`
      );
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
      }
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

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
      <div>
        <h1 className="text-2xl font-bold">Kanban</h1>
        <p className="text-muted-foreground">
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
          <div className="flex gap-4 pb-4" style={{ minWidth: "fit-content" }}>
            {KANBAN_COLUMNS.map((column) => {
              const columnLeads = leads.filter(
                (l) => l.status_kanban === column.key
              );

              return (
                <KanbanColumn
                  key={column.key}
                  id={column.key}
                  title={column.label}
                  count={columnLeads.length}
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
              <Card className="w-64 rotate-3 opacity-90 shadow-xl">
                <CardContent className="p-3">
                  <p className="font-medium text-sm">
                    {activeLead.name || "Sem nome"}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {activeLead.phone}
                  </p>
                  {activeLead.temperature && (
                    <Badge
                      className={`mt-2 ${
                        TEMPERATURE_COLORS[activeLead.temperature]
                      } text-white text-xs`}
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
      <div className="flex gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-64 shrink-0" />
        ))}
      </div>
    </div>
  );
}
