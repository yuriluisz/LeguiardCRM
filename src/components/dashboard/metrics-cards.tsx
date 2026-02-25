"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare } from "lucide-react";
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
      title: "Interações Hoje",
      value: metrics.interactionsToday,
      icon: MessageSquare,
      description: "Mensagens e interações ocorridas hoje",
      color: "text-green-500",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
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
            {/* removed: 'since last login' badge */}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
