"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/providers/tenant-provider";
import type { Lead, StatusKanban, Temperature } from "@/types/database";
import { STATUS_LABELS, TEMPERATURE_LABELS, TEMPERATURE_COLORS } from "@/types/database";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NewnessBadge } from "@/components/shared/newness-badge";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Bot,
  BotOff,
  ChevronLeft,
  ChevronRight,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function LeadsPage() {
  const router = useRouter();
  const { selectedTenant, loading: tenantLoading } = useTenant();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tempFilter, setTempFilter] = useState<string>("all");
  const [aiFilter, setAiFilter] = useState<string>("all");
  const [notALeadFilter, setNotALeadFilter] = useState<string>("all");
  const [lastLoginAt] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lastLoginAt");
    }
    return null;
  });

  // Toggle rápido sem modal de aviso
  async function quickToggle(leadId: string, field: "ai_active" | "not_a_lead", currentValue: boolean) {
    const newValue = !currentValue;
    // Otimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, [field]: newValue } : l))
    );
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });
      if (!res.ok) {
        // Rollback
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, [field]: currentValue } : l))
        );
        toast.error("Erro ao atualizar lead.");
      }
    } catch {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, [field]: currentValue } : l))
      );
      toast.error("Erro ao atualizar lead.");
    }
  }

  const fetchLeads = useCallback(async () => {
    if (!selectedTenant) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tenant_id: selectedTenant.id,
        page: page.toString(),
        limit: "25",
      });

      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (tempFilter !== "all") params.set("temperature", tempFilter);
      if (aiFilter !== "all") params.set("ai_active", aiFilter);
      if (notALeadFilter !== "all") params.set("not_a_lead", notALeadFilter);

      const res = await fetch(`/api/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedTenant, page, search, statusFilter, tempFilter, aiFilter, notALeadFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, tempFilter, aiFilter, notALeadFilter, selectedTenant]);

  if (tenantLoading) {
    return <LeadsSkeleton />;
  }

  if (!selectedTenant) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">
          Nenhuma empresa disponível.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-muted-foreground">
          {total} leads encontrados em {selectedTenant.name}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tempFilter} onValueChange={setTempFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas temp.</SelectItem>
            {Object.entries(TEMPERATURE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={aiFilter} onValueChange={setAiFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="IA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas IA</SelectItem>
            <SelectItem value="true">IA Ativa</SelectItem>
            <SelectItem value="false">IA Inativa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={notALeadFilter} onValueChange={setNotALeadFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="false">Leads</SelectItem>
            <SelectItem value="true">Não-leads</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {loading ? (
        <LeadsSkeleton showHeader={false} />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Temperatura</TableHead>
                  <TableHead>Última Interação</TableHead>
                  <TableHead>IA</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhum lead encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/leads/${lead.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {lead.name || "Sem nome"}
                          </span>
                          <NewnessBadge
                            createdAt={lead.created_at}
                            lastInteraction={lead.last_interaction}
                            lastLoginAt={lastLoginAt}
                          />
                          {lead.not_a_lead && (
                            <Badge variant="outline" className="text-xs">
                              Não-lead
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {lead.phone}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {STATUS_LABELS[lead.status_kanban] ||
                            lead.status_kanban}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.temperature ? (
                          <Badge
                            className={`${
                              TEMPERATURE_COLORS[lead.temperature]
                            } text-white`}
                          >
                            {TEMPERATURE_LABELS[lead.temperature]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.last_interaction
                          ? format(
                              new Date(lead.last_interaction),
                              "dd/MM/yyyy HH:mm",
                              {
                                locale: ptBR,
                              }
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {lead.ai_active ? (
                          <Bot className="h-4 w-4 text-green-500" />
                        ) : (
                          <BotOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={lead.not_a_lead ? "destructive" : "outline"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => quickToggle(lead.id, "not_a_lead", lead.not_a_lead)}
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {lead.not_a_lead ? "Marcar como lead" : "Marcar como não-lead"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={lead.ai_active ? "default" : "outline"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => quickToggle(lead.id, "ai_active", lead.ai_active)}
                              >
                                {lead.ai_active ? (
                                  <Bot className="h-4 w-4" />
                                ) : (
                                  <BotOff className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {lead.ai_active ? "Desligar IA" : "Ligar IA"}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} ({total} leads)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Próxima
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeadsSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="space-y-4">
      {showHeader && (
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
