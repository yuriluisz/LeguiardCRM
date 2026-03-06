"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/types/database";
import { TEMPERATURE_LABELS, TEMPERATURE_COLORS } from "@/types/database";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
  lead: Lead;
  onClick: () => void;
}

export function KanbanCard({ lead, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: lead.id,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab border-border/50 bg-card transition-all duration-150 hover:shadow-md hover:border-border active:cursor-grabbing",
        isDragging && "opacity-40 shadow-xl scale-105 rotate-1"
      )}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate leading-tight">
              {lead.name || "Sem nome"}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {lead.phone}
            </p>
          </div>
          {lead.ai_active && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10">
              <Bot className="h-3 w-3 shrink-0 text-green-500" />
            </div>
          )}
        </div>

        {lead.temperature && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              className={`${TEMPERATURE_COLORS[lead.temperature]} text-white text-[10px] px-1.5 py-0 shadow-sm`}
            >
              {TEMPERATURE_LABELS[lead.temperature]}
            </Badge>
          </div>
        )}

        {lead.last_interaction && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <p className="text-[10px]">
              {format(new Date(lead.last_interaction), "dd/MM HH:mm", {
                locale: ptBR,
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
