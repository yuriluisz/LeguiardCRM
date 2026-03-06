"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  color?: string;
  children: React.ReactNode;
}

export function KanbanColumn({ id, title, count, color, children }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/20 transition-all duration-200",
        isOver && "border-primary/60 bg-primary/5 shadow-lg shadow-primary/10"
      )}
    >
      {/* Header da coluna com barra de cor */}
      <div className="relative flex items-center justify-between px-3 py-3">
        {/* Barra de cor no topo */}
        <div
          className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
          style={{ backgroundColor: color || "#6b7280" }}
        />
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color || "#6b7280" }}
          />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
          style={{ backgroundColor: color || "#6b7280" }}
        >
          {count}
        </span>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1">
        <div className="space-y-2.5 px-2 pb-3 pt-1" style={{ minHeight: "80px" }}>
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}
