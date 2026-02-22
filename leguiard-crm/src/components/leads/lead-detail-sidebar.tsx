"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Lead } from "@/types/database";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Mail, Calendar, Hash, Clock } from "lucide-react";

interface LeadDetailSidebarProps {
  lead: Lead;
}

export function LeadDetailSidebar({ lead }: LeadDetailSidebarProps) {
  const fields = [
    {
      icon: Phone,
      label: "Telefone",
      value: lead.phone,
    },
    {
      icon: Mail,
      label: "Email",
      value: lead.email || "—",
    },
    {
      icon: Calendar,
      label: "Criado em",
      value: format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", {
        locale: ptBR,
      }),
    },
    {
      icon: Clock,
      label: "Última interação",
      value: lead.last_interaction
        ? format(new Date(lead.last_interaction), "dd/MM/yyyy HH:mm", {
            locale: ptBR,
          })
        : "—",
    },
    {
      icon: Hash,
      label: "Execuções da IA",
      value: lead.ai_run_count.toString(),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Informações do Lead</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.label}>
            <div className="flex items-start gap-3">
              <field.icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {field.label}
                </p>
                <p className="text-sm break-all">{field.value}</p>
              </div>
            </div>
            {index < fields.length - 1 && <Separator className="mt-3" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
