"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TEMPERATURE_LABELS } from "@/types/database";

interface TemperatureDistributionChartProps {
  data: { temperature: string; count: number }[];
}

const TEMP_COLORS: Record<string, string> = {
  frio: "#3b82f6",
  morno: "#f59e0b",
  quente: "#ef4444",
  sem_info: "#9ca3af",
};

export function TemperatureDistributionChart({
  data,
}: TemperatureDistributionChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    label:
      TEMPERATURE_LABELS[item.temperature] ||
      (item.temperature === "sem_info" ? "Sem info" : item.temperature),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Distribuição por Temperatura
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart h-64 min-w-0" onMouseDown={(e) => e.preventDefault()}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart accessibilityLayer={false}>
              <Pie
                data={formattedData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="count"
                nameKey="label"
              >
                {formattedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={TEMP_COLORS[entry.temperature] || "#6b7280"}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [value, "Leads"]}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
