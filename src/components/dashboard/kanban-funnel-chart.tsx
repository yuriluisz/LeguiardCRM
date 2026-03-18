"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FunnelChart,
  Funnel,
  Tooltip,
  LabelList,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface KanbanFunnelChartProps {
  data: { key: string; label: string; count: number; color?: string; order: number }[];
}

export function KanbanFunnelChart({ data }: KanbanFunnelChartProps) {
  const totalLeads = data.reduce((acc, item) => acc + item.count, 0);

  const chartData = [...data]
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      ...item,
      value: item.count,
      percentage: totalLeads > 0 ? (item.count / totalLeads) * 100 : 0,
      fill: item.color || "#3b82f6",
    }));

  const firstStageCount = chartData[0]?.value || 0;
  const lastStageCount = chartData[chartData.length - 1]?.value || 0;
  const conversionRate = firstStageCount > 0 ? (lastStageCount / firstStageCount) * 100 : 0;
  const dynamicHeight = Math.min(
    620,
    Math.max(240, chartData.length * 52 + 80)
  );

  return (
    <Card className="h-auto self-start">
      <CardHeader>
        <div>
          <CardTitle className="text-base">Funil do Kanban Principal</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Distribuicao dos leads por etapa do pipeline principal
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Total no pipeline
              </p>
              <p className="text-lg font-semibold leading-none">{totalLeads}</p>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Conversao
              </p>
              <p className="text-lg font-semibold leading-none">
                {conversionRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="dashboard-chart min-w-0"
          style={{ height: dynamicHeight }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <FunnelChart margin={{ top: 12, right: 12, left: 12, bottom: 12 }}>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value, _name, item) => {
                  const row = item.payload as {
                    percentage?: number;
                  };
                  const numericValue = Number(value || 0);
                  return [
                    `${numericValue} leads (${(row.percentage || 0).toFixed(1)}%)`,
                    "Volume",
                  ];
                }}
                labelFormatter={(_label, payload) => {
                  const row = payload?.[0]?.payload as { label?: string };
                  return row?.label || "Etapa";
                }}
              />
              <Funnel dataKey="value" data={chartData} isAnimationActive>
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="label"
                  position="center"
                  content={(props) => {
                    const { x, y, width, height, value } = props;

                    if (
                      typeof x !== "number" ||
                      typeof y !== "number" ||
                      typeof width !== "number" ||
                      typeof height !== "number"
                    ) {
                      return null;
                    }

                    if (width < 90 || height < 26) {
                      return null;
                    }

                    return (
                      <text
                        x={x + width / 2}
                        y={y + height / 2 + 4}
                        textAnchor="middle"
                        fill="hsl(var(--primary-foreground))"
                        fontSize={12}
                        fontWeight={600}
                        stroke="rgba(0, 0, 0, 0.35)"
                        strokeWidth={2}
                        paintOrder="stroke"
                      >
                        {String(value || "")}
                      </text>
                    );
                  }}
                />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
