"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { Interaction } from "@/types/database";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, Bot } from "lucide-react";

interface LeadChatProps {
  interactions: Interaction[];
}

export function LeadChat({ interactions }: LeadChatProps) {
  if (interactions.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Nenhuma interação registrada.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-4 p-4">
        {interactions.map((interaction) => (
          <div
            key={interaction.id}
            className={cn(
              "flex gap-3",
              interaction.role === "assistant" ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                interaction.role === "assistant"
                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {interaction.role === "assistant" ? (
                <Bot className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>

            {/* Bolha */}
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2.5",
                interaction.role === "assistant"
                  ? "rounded-tr-md bg-primary text-primary-foreground"
                  : "rounded-tl-md bg-muted"
              )}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {interaction.content}
              </p>
              <p
                className={cn(
                  "mt-1 text-[10px]",
                  interaction.role === "assistant"
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                )}
              >
                {format(
                  new Date(interaction.created_at),
                  "dd/MM/yyyy HH:mm",
                  { locale: ptBR }
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
