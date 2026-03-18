"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-provider";
import type {
  Lead,
  Interaction,
  CrmConfig,
  StatusKanban,
  CrmField,
  CrmFieldType,
} from "@/types/database";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createLeaderTabCoordinator } from "@/lib/realtime/leader-tab";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getJsonWithDedupe } from "@/lib/utils/client-get-cache";

type ConversationsClientProps = {
  initialTenantId: string | null;
  initialLeads: Lead[];
  initialSelectedLead: Lead | null;
  initialInteractions: Interaction[];
  initialCrmConfig: CrmConfig | null;
};

const CRM_FIELD_TYPES: readonly CrmFieldType[] = ["text", "number", "select", "date"];

function isCrmFieldType(value: string): value is CrmFieldType {
  return CRM_FIELD_TYPES.includes(value as CrmFieldType);
}

function normalizeCrmConfig(raw: unknown): CrmConfig | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const candidateFields = source.fields ?? source.custom_fields ?? source.customDataFields;
  const fieldList = Array.isArray(candidateFields) ? candidateFields : [];

  const fields = fieldList
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const key = typeof row.key === "string" ? row.key : "";
      const label = typeof row.label === "string" ? row.label : key;
      const rawType = typeof row.type === "string" ? row.type : "text";
      const type: CrmFieldType = isCrmFieldType(rawType) ? rawType : "text";

      if (!key) {
        return null;
      }

      return { key, label, type };
    })
    .filter((item): item is CrmField => Boolean(item));

  return { fields };
}

export default function ConversationsClient({
  initialTenantId,
  initialLeads,
  initialSelectedLead,
  initialInteractions,
  initialCrmConfig,
}: ConversationsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const leadParam = searchParams.get("lead");
  const { selectedTenant, loading: tenantLoading, demoMode } = useTenant();

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(initialSelectedLead);
  const [interactions, setInteractions] = useState<Interaction[]>(initialInteractions);
  const [crmConfig, setCrmConfig] = useState<CrmConfig | null>(initialCrmConfig);
  const [loading, setLoading] = useState(!initialTenantId);
  const [loadingChat, setLoadingChat] = useState(false);
  const [search, setSearch] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialLeadLoaded = useRef(false);
  const leadsRealtimeHealthyRef = useRef(false);
  const interactionsRealtimeHealthyRef = useRef(false);
  const leadsFetchInFlightRef = useRef(false);
  const lastLeadsSilentSyncAtRef = useRef(0);
  const interactionsFetchInFlightRef = useRef(false);
  const lastInteractionsSilentSyncAtRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setShowInfoPanel(false);
    }
  }, []);

  const normalizeLead = useCallback((lead: Lead): Lead => {
    return {
      ...lead,
      status_kanban: lead.status_kanban
        ? String(lead.status_kanban).toLowerCase()
        : lead.status_kanban,
    };
  }, []);

  // Fetch leads for selected tenant
  const fetchLeads = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!selectedTenant) return [];
    const showLoading = options?.showLoading ?? false;
    const now = Date.now();

    if (!showLoading) {
      if (leadsFetchInFlightRef.current) {
        return [];
      }

      if (now - lastLeadsSilentSyncAtRef.current < 45000) {
        return [];
      }
    }

    leadsFetchInFlightRef.current = true;
    if (showLoading) {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        tenant_id: selectedTenant.id,
        limit: "300",
        lite: "true",
      });

      const data = await getJsonWithDedupe<{ leads?: Lead[] }>(
        `/api/leads?${params.toString()}`,
        { cacheMs: 4000 }
      );
      const fetchedLeads = (data.leads as Lead[]) ?? [];
      setLeads(fetchedLeads);
      if (!showLoading) {
        lastLeadsSilentSyncAtRef.current = Date.now();
      }
      return fetchedLeads;
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
      toast.error("Erro ao carregar leads");
      return [];
    } finally {
      leadsFetchInFlightRef.current = false;
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [selectedTenant]);

  const fetchLeadConversation = useCallback(
    async (leadId: string, options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoadingChat(true);
      }

      try {
        if (!showLoading) {
          if (interactionsFetchInFlightRef.current) {
            return;
          }

          const now = Date.now();
          if (now - lastInteractionsSilentSyncAtRef.current < 30000) {
            return;
          }
        }

        interactionsFetchInFlightRef.current = true;
        const data = await getJsonWithDedupe<{
          lead?: Lead;
          interactions?: Interaction[];
          crmConfig?: unknown;
        }>(`/api/leads/${leadId}`);
        const fullLead = data.lead as Lead | undefined;
        setInteractions((data.interactions as Interaction[]) ?? []);
        setCrmConfig(normalizeCrmConfig(data.crmConfig));

        if (fullLead?.id) {
          const normalizedLead: Lead = {
            ...fullLead,
            status_kanban: fullLead.status_kanban
              ? String(fullLead.status_kanban).toLowerCase()
              : fullLead.status_kanban,
          };

          setLeads((prev) =>
            prev.map((lead) => (lead.id === normalizedLead.id ? { ...lead, ...normalizedLead } : lead))
          );
          setSelectedLead((prev) =>
            prev && prev.id === normalizedLead.id ? { ...prev, ...normalizedLead } : prev
          );
        }

        if (!showLoading) {
          lastInteractionsSilentSyncAtRef.current = Date.now();
        }
      } catch (error) {
        console.error("Erro ao buscar interações:", error);
        toast.error("Erro ao carregar conversa");
        setInteractions([]);
      } finally {
        interactionsFetchInFlightRef.current = false;
        if (showLoading) {
          setLoadingChat(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const hasMatchingTenantSeed =
      selectedTenant && initialTenantId && selectedTenant.id === initialTenantId;

    if (hasMatchingTenantSeed) {
      setLeads(initialLeads);
      setLoading(false);
      if (initialLeads.length < 300) {
        void fetchLeads({ showLoading: false });
      }

      if (leadParam && !initialLeadLoaded.current) {
        initialLeadLoaded.current = true;

        if (initialSelectedLead && initialSelectedLead.id === leadParam) {
          setSelectedLead(initialSelectedLead);
          setInteractions(initialInteractions);
          setCrmConfig(initialCrmConfig);
          return;
        }
      }

      if (!leadParam) {
        return;
      }
    }

    fetchLeads({ showLoading: true }).then((fetchedLeads) => {
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
  }, [
    fetchLeads,
    initialCrmConfig,
    initialInteractions,
    initialLeads,
    initialSelectedLead,
    initialTenantId,
    leadParam,
    selectedTenant,
  ]);

  useEffect(() => {
    if (!selectedTenant) return;
    if (demoMode) return;

    const supabase = createClient();
    const channelTopic = `conversations-leads-${selectedTenant.id}-${Math.random().toString(36).slice(2)}`;
    const coordinator = createLeaderTabCoordinator(`conversations-leads:${selectedTenant.id}`);
    const leadsSyncTimer = window.setInterval(() => {
      if (!document.hidden && !leadsRealtimeHealthyRef.current && coordinator.shouldRun()) {
        void fetchLeads({ showLoading: false });
      }
    }, 60000);
    const channel = supabase
      .channel(channelTopic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const payloadTenantId =
            (payload.new as { tenant_id?: string } | null)?.tenant_id ??
            (payload.old as { tenant_id?: string } | null)?.tenant_id;

          if (!payloadTenantId) {
            return;
          }

          if (String(payloadTenantId) !== selectedTenant.id) {
            return;
          }

          if (payload.eventType === "DELETE") {
            const oldLead = payload.old as { id?: string };
            if (!oldLead.id) return;

            setLeads((prev) => prev.filter((lead) => lead.id !== oldLead.id));
            if (selectedLead?.id === oldLead.id) {
              setSelectedLead(null);
              setInteractions([]);
            }
            return;
          }

          const incoming = payload.new as unknown as Lead;
          if (!incoming?.id) return;

          const normalized = normalizeLead(incoming);

          setLeads((prev) => {
            const index = prev.findIndex((lead) => lead.id === normalized.id);
            if (index === -1) {
              return [normalized, ...prev];
            }

            const next = [...prev];
            next[index] = { ...next[index], ...normalized };
            return next;
          });

          if (selectedLead?.id === normalized.id) {
            setSelectedLead((prev) => (prev ? { ...prev, ...normalized } : prev));
          }
        }
      )
      .subscribe((status: string, error?: Error) => {
        if (status === "SUBSCRIBED") {
          leadsRealtimeHealthyRef.current = true;
          return;
        }

        if (status === "CLOSED") {
          leadsRealtimeHealthyRef.current = false;
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          leadsRealtimeHealthyRef.current = false;
          console.warn(
            "Realtime conversations (leads) instavel:",
            status,
            error?.message || error || "sem detalhe"
          );
        }
      });

    return () => {
      leadsRealtimeHealthyRef.current = false;
      coordinator.release();
      window.clearInterval(leadsSyncTimer);
      void supabase.removeChannel(channel);
    };
  }, [demoMode, fetchLeads, normalizeLead, selectedLead?.id, selectedTenant]);

  useEffect(() => {
    if (!selectedLead?.id) return;
    if (demoMode) return;

    const supabase = createClient();
    const channelTopic = `conversations-interactions-${selectedLead.id}-${Math.random().toString(36).slice(2)}`;
    const coordinator = createLeaderTabCoordinator(`conversations-interactions:${selectedLead.id}`);
    const syncTimer = window.setInterval(() => {
      if (!document.hidden && !interactionsRealtimeHealthyRef.current && coordinator.shouldRun()) {
        void fetchLeadConversation(selectedLead.id, { showLoading: false });
      }
    }, 30000);

    const channel = supabase
      .channel(channelTopic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "interactions",
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const payloadLeadId =
            (payload.new as { lead_id?: string } | null)?.lead_id ??
            (payload.old as { lead_id?: string } | null)?.lead_id;

          if (!payloadLeadId) {
            return;
          }

          if (String(payloadLeadId) !== selectedLead.id) {
            return;
          }

          if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id?: string };
            if (!deleted.id) return;
            setInteractions((prev) => prev.filter((item) => item.id !== deleted.id));
            return;
          }

          const incoming = payload.new as unknown as Interaction;
          if (!incoming?.id) return;

          if (payload.eventType === "UPDATE") {
            setInteractions((prev) =>
              prev.map((item) => (item.id === incoming.id ? { ...item, ...incoming } : item))
            );
            return;
          }

          setInteractions((prev) => {
            if (prev.some((item) => item.id === incoming.id)) {
              return prev;
            }

            return [...prev, incoming];
          });
        }
      )
      .subscribe((status: string, error?: Error) => {
        if (status === "SUBSCRIBED") {
          interactionsRealtimeHealthyRef.current = true;
          return;
        }

        if (status === "CLOSED") {
          interactionsRealtimeHealthyRef.current = false;
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          interactionsRealtimeHealthyRef.current = false;
          console.warn(
            "Realtime conversations (interactions) instavel:",
            status,
            error?.message || error || "sem detalhe"
          );
        }
      });

    return () => {
      interactionsRealtimeHealthyRef.current = false;
      coordinator.release();
      window.clearInterval(syncTimer);
      void supabase.removeChannel(channel);
    };
  }, [demoMode, fetchLeadConversation, selectedLead?.id]);

  // Fetch interactions when a lead is selected
  async function selectLead(lead: Lead) {
    setSelectedLead(lead);

    // On mobile, hide leads sidebar when a lead is selected
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }

    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("lead", lead.id);
    router.replace(`/conversations?${params.toString()}`, { scroll: false });

    await fetchLeadConversation(lead.id, { showLoading: true });
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [interactions]);

  async function resetConvId(leadId: string) {
    if (demoMode) {
      toast.info("Modo Demo ativo: alteracoes estao bloqueadas.");
      return;
    }

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
    if (demoMode) {
      toast.info("Modo Demo ativo: alteracoes estao bloqueadas.");
      return;
    }

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
    if (demoMode) {
      toast.info("Modo Demo ativo: alteracoes estao bloqueadas.");
      return;
    }

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

  async function changeStatus(leadId: string, newStatus: StatusKanban) {
    if (!selectedLead) return;
    if (demoMode) {
      toast.info("Modo Demo ativo: alteracoes estao bloqueadas.");
      return;
    }

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
      <div className="flex h-[calc(100dvh-5.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedTenant) {
    return (
      <div className="flex h-[calc(100dvh-5.5rem)] items-center justify-center text-muted-foreground">
        Selecione um tenant para ver as conversas.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-6.5rem)] gap-0 overflow-hidden rounded-lg border bg-background">
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
          {demoMode && (
            <p className="px-1 text-xs font-medium text-amber-600">
              Modo Demo ativo: conversa em somente leitura.
            </p>
          )}
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
                      <span className="hidden whitespace-nowrap text-[10px] text-muted-foreground sm:inline">
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
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-3 sm:gap-3 sm:px-4">
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
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex"
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
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              {/* Messages */}
              <ScrollArea
                className={cn(
                  "min-h-0",
                  showInfoPanel ? "hidden lg:block lg:flex-1" : "flex-1"
                )}
              >
                <div className="space-y-4 px-3 py-4 sm:px-4">
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
                            "max-w-[88%] rounded-lg px-3 py-2.5 sm:max-w-[80%] sm:px-4",
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
                <div className="flex min-h-0 flex-1 w-full flex-col border-t lg:w-80 lg:flex-none lg:border-t-0 lg:border-l xl:w-96">
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
                              Etapa Follow-up
                            </span>
                            <Badge variant="outline" className="max-w-[180px] truncate">
                              {selectedLead.follow_stage || "Sem etapa"}
                            </Badge>
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

