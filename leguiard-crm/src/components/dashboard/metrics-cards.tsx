"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Flame, Bot } from "lucide-react";
import type { DashboardMetrics } from "@/types/database";

interface MetricsCardsProps {
  metrics: DashboardMetrics;
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  const cards = [
    {
      title: "Total de Leads",
      value: metrics.totalLeads,
      icon: Users,
      description: "Todos os leads cadastrados",
      color: "text-blue-500",
    },
    {
      title: "Novos (7 dias)",
      value: metrics.newLeadsLast7Days,
      icon: UserPlus,
      description: "Leads criados nos últimos 7 dias",
      color: "text-green-500",
    },
    {
      title: "Leads Quentes",
      value: metrics.hotLeads,
      icon: Flame,
      description: "Leads com temperatura quente",
      color: "text-red-500",
    },
    {
      title: "IA Ativa",
      value: metrics.aiActiveLeads,
      icon: Bot,
      description: "Leads com agente IA ativo",
      color: "text-purple-500",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{card.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
            {card.title === "Novos (7 dias)" &&
              metrics.newSinceLastLogin > 0 && (
                <Badge
                  variant="secondary"
                  className="mt-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {metrics.newSinceLastLogin} desde último login
                </Badge>
              )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
