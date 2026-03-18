"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTenant } from "@/components/providers/tenant-provider";
import type { DashboardMetrics } from "@/types/database";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart";
import { KanbanFunnelChart } from "@/components/dashboard/kanban-funnel-chart";
import { FollowupDistributionChart } from "@/components/dashboard/followup-distribution-chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { getJsonWithDedupe } from "@/lib/utils/client-get-cache";

type DashboardClientProps = {
  initialMetrics: DashboardMetrics | null;
  initialTenantId: string | null;
};

export default function DashboardClient({
  initialMetrics,
  initialTenantId,
}: DashboardClientProps) {
  const { selectedTenant, loading: tenantLoading } = useTenant();
  const isBronzeTenant =
    String(selectedTenant?.plan_level || "").toLowerCase() === "bronze";

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(initialMetrics);
  const [loading, setLoading] = useState(!initialMetrics);
  const [rangeDays, setRangeDays] = useState<number>(7);
  const refreshTimerRef = useRef<number | null>(null);

  const fetchMetrics = useCallback(
    async (silent = false) => {
      if (!selectedTenant) return;
      if (!silent) setLoading(true);

      try {
        const data = await getJsonWithDedupe<DashboardMetrics>(
          `/api/dashboard?tenant_id=${selectedTenant.id}`,
          { cacheMs: 2000 }
        );
        setMetrics(data);
      } catch (error) {
        console.error("Erro ao carregar métricas:", error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [selectedTenant]
  );

  useEffect(() => {
    if (!selectedTenant) return;

    if (initialMetrics && initialTenantId === selectedTenant.id) {
      setMetrics(initialMetrics);
      setLoading(false);
      return;
    }

    void fetchMetrics();
  }, [fetchMetrics, initialMetrics, initialTenantId, selectedTenant]);

  useEffect(() => {
    if (!selectedTenant) return;

    const supabase = createClient();
    const leadsTopic = `dashboard-leads-${selectedTenant.id}-${Math.random()
      .toString(36)
      .slice(2)}`;
    const interactionsTopic = `dashboard-interactions-${selectedTenant.id}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        void fetchMetrics(true);
      }, 350);
    };

    const leadsChannel = supabase
      .channel(leadsTopic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `tenant_id=eq.${selectedTenant.id}`,
        },
        scheduleRefresh
      )
      .subscribe();

    const interactionsChannel = supabase
      .channel(interactionsTopic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "interactions",
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(leadsChannel);
      void supabase.removeChannel(interactionsChannel);
    };
  }, [fetchMetrics, selectedTenant]);

  if (tenantLoading) {
    return <DashboardSkeleton />;
  }

  if (!selectedTenant) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">
          Nenhuma empresa disponível. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  if (loading || !metrics) {
    return <DashboardSkeleton />;
  }

  function sliceLast(data: { date: string; count: number }[], n: number) {
    return data.slice(Math.max(0, data.length - n));
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold sm:text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Visão geral dos leads de {selectedTenant.name}
        </p>
      </div>

      <MetricsCards metrics={metrics} />

      <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
        <Button
          size="sm"
          variant={rangeDays === 7 ? "default" : "outline"}
          onClick={() => setRangeDays(7)}
          className="flex-1 sm:flex-none"
        >
          7 dias
        </Button>
        <Button
          size="sm"
          variant={rangeDays === 14 ? "default" : "outline"}
          onClick={() => setRangeDays(14)}
          className="flex-1 sm:flex-none"
        >
          14 dias
        </Button>
        <Button
          size="sm"
          variant={rangeDays === 30 ? "default" : "outline"}
          onClick={() => setRangeDays(30)}
          className="flex-1 sm:flex-none"
        >
          30 dias
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <TimeSeriesChart
          title="Leads por Dia"
          data={sliceLast(metrics.leadsPerDay, rangeDays)}
          valueLabel="Leads"
          color="#3b82f6"
          description="Leads novos criados por dia"
        />
        <TimeSeriesChart
          title="Conversas por Dia"
          data={sliceLast(metrics.conversationsPerDay, rangeDays)}
          valueLabel="Conversas"
          color="#7c3aed"
          description="Leads com interações no dia"
        />
        <TimeSeriesChart
          title="Mensagens por Dia"
          data={sliceLast(metrics.messagesPerDay, rangeDays)}
          valueLabel="Mensagens"
          color="#10b981"
          description="Total de mensagens trocadas no dia"
        />
      </div>

      <div
        className={`grid items-start gap-6 ${
          isBronzeTenant ? "xl:grid-cols-1" : "xl:grid-cols-2"
        }`}
      >
        <KanbanFunnelChart data={metrics.kanbanFunnel} />
        {!isBronzeTenant && (
          <FollowupDistributionChart data={metrics.followupDistribution} />
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
