"use client";

import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/components/providers/tenant-provider";
import type { DashboardMetrics } from "@/types/database";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { LeadsOverTimeChart } from "@/components/dashboard/leads-over-time-chart";
import { StatusDistributionChart } from "@/components/dashboard/status-distribution-chart";
import { TemperatureDistributionChart } from "@/components/dashboard/temperature-distribution-chart";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { selectedTenant, loading: tenantLoading } = useTenant();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    if (!selectedTenant) return;
    setLoading(true);

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
      setLoading(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral dos leads de {selectedTenant.name}
        </p>
      </div>

      <MetricsCards metrics={metrics} />

      <div className="grid gap-6 md:grid-cols-2">
        <LeadsOverTimeChart data={metrics.leadsOverTime} />
        <StatusDistributionChart data={metrics.statusDistribution} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <TemperatureDistributionChart data={metrics.temperatureDistribution} />
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
