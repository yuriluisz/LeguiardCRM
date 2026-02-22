"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewnessBadge } from "@/components/shared/newness-badge";
import type { Lead } from "@/types/database";
import { TEMPERATURE_LABELS, TEMPERATURE_COLORS } from "@/types/database";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
  lead: Lead;
  lastLoginAt: string | null;
  onClick: () => void;
}

export function KanbanCard({ lead, lastLoginAt, onClick }: KanbanCardProps) {
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
        "cursor-grab transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-50 shadow-lg"
      )}
      onClick={(e) => {
        // Só navega se não estiver arrastando
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">
              {lead.name || "Sem nome"}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {lead.phone}
            </p>
          </div>
          {lead.ai_active && (
            <Bot className="h-4 w-4 shrink-0 text-green-500" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {lead.temperature && (
            <Badge
              className={`${TEMPERATURE_COLORS[lead.temperature]} text-white text-[10px] px-1.5 py-0`}
            >
              {TEMPERATURE_LABELS[lead.temperature]}
            </Badge>
          )}
          <NewnessBadge
            createdAt={lead.created_at}
            lastInteraction={lead.last_interaction}
            lastLoginAt={lastLoginAt}
          />
        </div>

        {lead.last_interaction && (
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(lead.last_interaction), "dd/MM HH:mm", {
              locale: ptBR,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
