"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-provider";
import type { Lead, Interaction, CrmConfig, StatusKanban } from "@/types/database";
import { getKanbanColumns, getStatusLabel } from "@/types/database";
import { CustomDataFields } from "@/components/leads/custom-data-fields";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bot,
  User,
  Phone,
  Mail,
  Search,
  RotateCcw,
  MessageSquare,
  Loader2,
  ChevronLeft,
  Calendar,
  Flame,
  Thermometer,
  Snowflake,
  HelpCircle,
  ChevronDown,
  Save,
  PanelRightOpen,
  PanelRightClose,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function ConversationsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const leadParam = searchParams.get("lead");
  const { selectedTenant, loading: tenantLoading } = useTenant();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [crmConfig, setCrmConfig] = useState<CrmConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [search, setSearch] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [customDataRaw, setCustomDataRaw] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);
  const [showCustomData, setShowCustomData] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialLeadLoaded = useRef(false);

  // Fetch leads for selected tenant
  const fetchLeads = useCallback(async () => {
    if (!selectedTenant) return [];
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tenant_id: selectedTenant.id,
        limit: "500",
      });

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error("Falha ao buscar leads");

      const data = await res.json();
      const fetchedLeads = (data.leads as Lead[]) ?? [];
      setLeads(fetchedLeads);
      return fetchedLeads;
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
      toast.error("Erro ao carregar leads");
      return [];
    } finally {
      setLoading(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    fetchLeads().then((fetchedLeads) => {
      // Auto-select lead from URL param
      if (leadParam && !initialLeadLoaded.current) {
        initialLeadLoaded.current = true;
        const lead = fetchedLeads.find((l) => l.id === leadParam);
        if (lead) {
          selectLead(lead);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLeads]);

  // Fetch interactions when a lead is selected
  async function selectLead(lead: Lead) {
    setSelectedLead(lead);
    setLoadingChat(true);
    setCustomDataRaw(JSON.stringify(lead.custom_data ?? {}, null, 2));
    setShowCustomData(false);

    // On mobile, hide leads sidebar when a lead is selected
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }

    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("lead", lead.id);
    router.replace(`/conversations?${params.toString()}`, { scroll: false });

    try {
      const res = await fetch(`/api/leads/${lead.id}`);
      if (!res.ok) throw new Error("Falha ao buscar interações");

      const data = await res.json();
      setInteractions((data.interactions as Interaction[]) ?? []);
      setCrmConfig(data.crmConfig ?? null);
    } catch (error) {
      console.error("Erro ao buscar interações:", error);
      toast.error("Erro ao carregar conversa");
      setInteractions([]);
    } finally {
      setLoadingChat(false);
    }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [interactions]);

  async function resetConvId(leadId: string) {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conv_id: null }),
      });

      if (!res.ok) throw new Error();

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, conv_id: null } : l))
      );
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, conv_id: null } : prev));
      }
      toast.success("Conversa resetada");
    } catch {
      toast.error("Erro ao resetar conversa");
    }
  }

  async function toggleAi(leadId: string, currentValue: boolean) {
    // Optimistic update
    const newValue = !currentValue;
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, ai_active: newValue } : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) =>
        prev ? { ...prev, ai_active: newValue } : prev
      );
    }

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_active: newValue }),
      });

      if (!res.ok) throw new Error();

      toast.success(`IA ${newValue ? "ativada" : "desativada"}`);
    } catch {
      // Rollback
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, ai_active: currentValue } : l
        )
      );
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) =>
          prev ? { ...prev, ai_active: currentValue } : prev
        );
      }
      toast.error("Erro ao atualizar IA");
    }
  }

  async function toggleNotALead(leadId: string, currentValue: boolean) {
    const newValue = !currentValue;
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, not_a_lead: newValue } : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) =>
        prev ? { ...prev, not_a_lead: newValue } : prev
      );
    }

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ not_a_lead: newValue }),
      });

      if (!res.ok) throw new Error();

      toast.success(newValue ? "Marcado como não é lead" : "Marcado como lead");
    } catch {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, not_a_lead: currentValue } : l
        )
      );
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) =>
          prev ? { ...prev, not_a_lead: currentValue } : prev
        );
      }
      toast.error("Erro ao atualizar status");
    }
  }

  async function saveCustomData() {
    if (!selectedLead) return;
    setSavingCustom(true);
    try {
      const parsed = JSON.parse(customDataRaw);
      const res = await fetch(`/api/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_data: parsed }),
      });

      if (!res.ok) throw new Error();

      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedLead.id ? { ...l, custom_data: parsed } : l
        )
      );
      setSelectedLead((prev) =>
        prev ? { ...prev, custom_data: parsed } : prev
      );
      toast.success("Custom data salvo");
    } catch {
      toast.error("Erro ao salvar (verifique se o JSON é válido)");
    }
    setSavingCustom(false);
  }

  async function changeStatus(leadId: string, newStatus: StatusKanban) {
    if (!selectedLead) return;
    const oldStatus = selectedLead.status_kanban;
    setSavingStatus(true);

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, status_kanban: newStatus } : l
      )
    );
    setSelectedLead((prev) =>
      prev ? { ...prev, status_kanban: newStatus } : prev
    );

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_kanban: newStatus }),
      });

      if (!res.ok) throw new Error();

      toast.success(`Status alterado para ${getStatusLabel(selectedTenant, newStatus)}`);
    } catch {
      // Rollback
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status_kanban: oldStatus } : l
        )
      );
      setSelectedLead((prev) =>
        prev ? { ...prev, status_kanban: oldStatus } : prev
      );
      toast.error("Erro ao alterar status");
    } finally {
      setSavingStatus(false);
    }
  }

  const filteredLeads = leads.filter((lead) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      lead.phone?.toLowerCase().includes(q) ||
      lead.name?.toLowerCase().includes(q) ||
      lead.email?.toLowerCase().includes(q)
    );
  });

  // Temperature config
  const tempConfig: Record<
    string,
    { icon: React.ElementType; color: string; label: string }
  > = {
    quente: { icon: Flame, color: "text-red-500", label: "Quente" },
    morno: { icon: Thermometer, color: "text-yellow-500", label: "Morno" },
    frio: { icon: Snowflake, color: "text-blue-500", label: "Frio" },
  };

  const TempIcon = selectedLead?.temperature
    ? (tempConfig[selectedLead.temperature]?.icon ?? HelpCircle)
    : HelpCircle;
  const tempColor = selectedLead?.temperature
    ? (tempConfig[selectedLead.temperature]?.color ?? "text-muted-foreground")
    : "text-muted-foreground";
  const tempLabel = selectedLead?.temperature
    ? (tempConfig[selectedLead.temperature]?.label ?? "Desconhecido")
    : "Desconhecido";

  // Loading state while tenant is loading
  if (tenantLoading) {
    return (
      <div className="flex h-[calc(100vh-5.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedTenant) {
    return (
      <div className="flex h-[calc(100vh-5.5rem)] items-center justify-center text-muted-foreground">
        Selecione um tenant para ver as conversas.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-5.5rem)] md:h-[calc(100vh-6.5rem)] gap-0 overflow-hidden rounded-lg border bg-background">
      {/* ============ LEFT SIDEBAR — Lista de Leads ============ */}
      <div
        className={cn(
          "flex flex-col border-r bg-muted/30 transition-all",
          showSidebar
            ? "w-full md:w-80 lg:w-96"
            : "hidden md:flex md:w-80 lg:w-96"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-3 space-y-2 border-b shrink-0">
          <h3 className="text-sm font-semibold px-1">Conversas</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar lead..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Leads List */}
        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum lead encontrado
            </p>
          ) : (
            <div className="divide-y">
              {filteredLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => selectLead(lead)}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-muted/60 transition-colors",
                    selectedLead?.id === lead.id && "bg-muted"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {lead.name || "Lead"}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {lead.last_interaction
                          ? format(
                              new Date(lead.last_interaction),
                              "dd/MM HH:mm",
                              { locale: ptBR }
                            )
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">
                        {lead.phone}
                      </span>
                      {lead.conv_id && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4"
                        >
                          conv
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ============ CENTER — Conversa ============ */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 min-h-0",
          showSidebar && "hidden md:flex"
        )}
      >
        {selectedLead ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
              {/* Mobile back button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden shrink-0"
                onClick={() => setShowSidebar(true)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {selectedLead.name || "Lead"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedLead.phone}
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:flex"
                  onClick={() => setShowInfoPanel(!showInfoPanel)}
                  title={showInfoPanel ? "Ocultar painel" : "Mostrar painel"}
                >
                  {showInfoPanel ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Chat + Info Panel */}
            <div className="flex flex-1 min-h-0">
              {/* Messages */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="px-4 py-4 space-y-4">
                  {loadingChat ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : interactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-20">
                      Nenhuma interação registrada
                    </p>
                  ) : (
                    interactions.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-3",
                          msg.role === "user" ? "" : "flex-row-reverse"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            msg.role === "user"
                              ? "bg-muted"
                              : "bg-primary text-primary-foreground"
                          )}
                        >
                          {msg.role === "user" ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-4 py-2.5",
                            msg.role === "user"
                              ? "bg-muted"
                              : "bg-primary text-primary-foreground"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.content}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-1",
                              msg.role === "user"
                                ? "text-muted-foreground"
                                : "text-primary-foreground/70"
                            )}
                          >
                            {format(
                              new Date(msg.created_at),
                              "dd/MM/yyyy HH:mm",
                              { locale: ptBR }
                            )}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* ============ RIGHT PANEL — Informações do Lead ============ */}
              {showInfoPanel && (
                <div className="hidden lg:flex w-80 xl:w-96 shrink-0 border-l flex-col min-h-0">
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-4 space-y-4">
                      {/* Dados do Lead */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Dados do Lead
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm">
                              {selectedLead.name || "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-mono">
                              {selectedLead.phone || "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm">
                              {selectedLead.email || "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm">
                              {format(
                                new Date(selectedLead.created_at),
                                "dd/MM/yyyy HH:mm",
                                { locale: ptBR }
                              )}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Controles */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Controles
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">IA Ativa</Label>
                            <Switch
                              checked={selectedLead.ai_active}
                              onCheckedChange={() =>
                                toggleAi(
                                  selectedLead.id,
                                  selectedLead.ai_active
                                )
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm text-muted-foreground">
                              Não é lead
                            </Label>
                            <Switch
                              checked={selectedLead.not_a_lead}
                              onCheckedChange={() =>
                                toggleNotALead(
                                  selectedLead.id,
                                  selectedLead.not_a_lead
                                )
                              }
                            />
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <Label className="text-sm text-muted-foreground">
                              Conversa IA
                            </Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resetConvId(selectedLead.id)}
                              disabled={!selectedLead.conv_id}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              Resetar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Status & Métricas */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Status & Métricas
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Status Kanban — editável */}
                          <div className="space-y-1.5">
                            <Label className="text-sm text-muted-foreground">
                              Status
                            </Label>
                            <Select
                              value={selectedLead.status_kanban}
                              onValueChange={(value) =>
                                changeStatus(
                                  selectedLead.id,
                                  value as StatusKanban
                                )
                              }
                              disabled={savingStatus}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getKanbanColumns(selectedTenant).map((col) => (
                                  <SelectItem key={col.key} value={col.key}>
                                    {col.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Temperatura
                            </span>
                            <div className="flex items-center gap-1.5">
                              <TempIcon className={`h-4 w-4 ${tempColor}`} />
                              <span className="text-sm">{tempLabel}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Execuções IA
                            </span>
                            <span className="text-sm font-medium">
                              {selectedLead.ai_run_count}
                            </span>
                          </div>
                          {selectedLead.ai_summary && (
                            <>
                              <Separator />
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  Resumo da IA
                                </Label>
                                <p className="text-sm leading-relaxed">
                                  {selectedLead.ai_summary}
                                </p>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>

                      {/* Dados Adicionais Estruturados */}
                      {crmConfig?.fields && crmConfig.fields.length > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                              <Sparkles className="h-3.5 w-3.5" />
                              Dados Adicionais
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <CustomDataFields
                              fields={crmConfig.fields}
                              data={selectedLead.custom_data}
                            />
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="h-12 w-12 opacity-30" />
            <p className="text-sm">Selecione um lead para ver a conversa</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense>
      <ConversationsContent />
    </Suspense>
  );
}
