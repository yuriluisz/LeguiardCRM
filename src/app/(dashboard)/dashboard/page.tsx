"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTenant } from "@/components/providers/tenant-provider";
import type { DashboardMetrics } from "@/types/database";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { LeadsOverTimeChart } from "@/components/dashboard/leads-over-time-chart";
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const { selectedTenant, loading: tenantLoading } = useTenant();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState<number>(7);
  const refreshTimerRef = useRef<number | null>(null);

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!selectedTenant) return;
    if (!silent) setLoading(true);

    try {
      const res = await fetch(
        `/api/dashboard?tenant_id=${selectedTenant.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Erro ao carregar métricas:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (!selectedTenant) return;

    const supabase = createClient();
    const leadsTopic = `dashboard-leads-${selectedTenant.id}-${Math.random().toString(36).slice(2)}`;
    const interactionsTopic = `dashboard-interactions-${selectedTenant.id}-${Math.random().toString(36).slice(2)}`;
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        fetchMetrics(true);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral dos leads de {selectedTenant.name}
        </p>
      </div>

      <MetricsCards metrics={metrics} />

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant={rangeDays === 7 ? "default" : "outline"}
          onClick={() => setRangeDays(7)}
        >
          7 dias
        </Button>
        <Button
          size="sm"
          variant={rangeDays === 14 ? "default" : "outline"}
          onClick={() => setRangeDays(14)}
        >
          14 dias
        </Button>
        <Button
          size="sm"
          variant={rangeDays === 30 ? "default" : "outline"}
          onClick={() => setRangeDays(30)}
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
        {Array.from({ length: 4 }).map((_, i) => (
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
