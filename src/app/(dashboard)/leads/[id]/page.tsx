"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Lead, Interaction, CrmConfig, StatusKanban } from "@/types/database";
import {
  STATUS_LABELS,
  TEMPERATURE_LABELS,
  TEMPERATURE_COLORS,
  KANBAN_COLUMNS,
} from "@/types/database";
import { LeadChat } from "@/components/leads/lead-chat";
import { LeadDetailSidebar } from "@/components/leads/lead-detail-sidebar";
import { CustomDataFields } from "@/components/leads/custom-data-fields";
import { ImpactWarningDialog } from "@/components/shared/impact-warning-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Bot, Brain, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [crmConfig, setCrmConfig] = useState<CrmConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado para edição com aviso
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    field: string;
    value: unknown;
    label: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchLead = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      if (res.ok) {
        const data = await res.json();
        setLead(data.lead);
        setInteractions(data.interactions);
        setCrmConfig(data.crmConfig);
      }
    } catch (error) {
      console.error("Erro ao carregar lead:", error);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  // Iniciar mudança com aviso (só para status_kanban)
  function initiateChange(field: string, value: unknown, label: string) {
    setPendingChange({ field, value, label });
    setWarningOpen(true);
  }

  // Update rápido sem modal (para ai_active e not_a_lead)
  async function quickUpdate(field: "ai_active" | "not_a_lead", value: boolean) {
    if (!lead) return;
    const oldValue = lead[field];
    setLead({ ...lead, [field]: value });

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLead(updated);
      } else {
        setLead({ ...lead, [field]: oldValue });
        toast.error("Erro ao atualizar lead.");
      }
    } catch {
      setLead({ ...lead, [field]: oldValue });
      toast.error("Erro ao salvar alteração.");
    }
  }

  // Confirmar mudança
  async function confirmChange() {
    if (!pendingChange || !lead) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [pendingChange.field]: pendingChange.value,
        }),
      });

      if (res.ok) {
        const updatedLead = await res.json();
        setLead(updatedLead);
        toast.success("Lead atualizado com sucesso!");
      } else {
        toast.error("Erro ao atualizar lead.");
      }
    } catch {
      toast.error("Erro ao salvar alteração.");
    } finally {
      setSaving(false);
      setWarningOpen(false);
      setPendingChange(null);
    }
  }

  if (loading) {
    return <LeadDetailSkeleton />;
  }

  if (!lead) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Lead não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lead.name || "Sem nome"}</h1>
          <p className="font-mono text-sm text-muted-foreground">
            {lead.phone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lead.temperature && (
            <Badge
              className={`${TEMPERATURE_COLORS[lead.temperature]} text-white`}
            >
              {TEMPERATURE_LABELS[lead.temperature]}
            </Badge>
          )}
          <Badge variant="secondary">
            {STATUS_LABELS[lead.status_kanban]}
          </Badge>
          {lead.ai_active && (
            <Badge className="bg-green-500 text-white">
              <Bot className="mr-1 h-3 w-3" />
              IA Ativa
            </Badge>
          )}
        </div>
      </div>

      {/* Layout principal: Chat + Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3" style={{ height: "calc(100vh - 180px)" }}>
        {/* Chat (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-hidden">
          {/* Resumo IA */}
          {lead.ai_summary && (
            <Card className="border-purple-200 dark:border-purple-800 shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-5 w-5 text-purple-500" />
                  Resumo da IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {lead.ai_summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Chat */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="text-base">
                Histórico de Conversas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <LeadChat interactions={interactions} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar (1/3) - scroll independente */}
        <div className="overflow-y-auto space-y-6 pr-1">
          {/* Dados do lead */}
          <LeadDetailSidebar lead={lead} />

          {/* Ações */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Kanban */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select
                  value={lead.status_kanban}
                  onValueChange={(value) =>
                    initiateChange(
                      "status_kanban",
                      value,
                      "Status do Kanban"
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KANBAN_COLUMNS.map((col) => (
                      <SelectItem key={col.key} value={col.key}>
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Toggle IA */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">IA Ativa</Label>
                  <p className="text-xs text-muted-foreground">
                    Liga/desliga o agente de IA
                  </p>
                </div>
                <Switch
                  checked={lead.ai_active}
                  onCheckedChange={(checked) =>
                    quickUpdate("ai_active", checked)
                  }
                />
              </div>

              {/* Toggle Não-lead */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Não é Lead</Label>
                  <p className="text-xs text-muted-foreground">
                    Marcar como não-lead
                  </p>
                </div>
                <Switch
                  checked={lead.not_a_lead}
                  onCheckedChange={(checked) =>
                    quickUpdate("not_a_lead", checked)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Dados customizados */}
          {crmConfig?.fields && crmConfig.fields.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4" />
                  Dados Adicionais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CustomDataFields
                  fields={crmConfig.fields}
                  data={lead.custom_data}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de aviso */}
      <ImpactWarningDialog
        open={warningOpen}
        onOpenChange={setWarningOpen}
        onConfirm={confirmChange}
        loading={saving}
        fieldName={pendingChange?.label}
      />
    </div>
  );
}

function LeadDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-1 h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="h-96" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}
