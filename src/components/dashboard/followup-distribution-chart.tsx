"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface FollowupDistributionChartProps {
  data: { stage: string; count: number; color?: string; order: number }[];
}

export function FollowupDistributionChart({ data }: FollowupDistributionChartProps) {
  const chartData = [...data]
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      ...item,
      fill: item.color || "#10b981",
    }));

  const rowHeight = 36;
  const dynamicHeight = Math.min(
    560,
    Math.max(220, chartData.length * rowHeight + 80)
  );

  return (
    <Card className="h-auto self-start">
      <CardHeader>
        <CardTitle className="text-base">Etapas de Follow-up</CardTitle>
        <p className="text-xs text-muted-foreground">
          Volume de leads por etapa de follow-up
        </p>
      </CardHeader>
      <CardContent>
        <div
          className="dashboard-chart min-w-0 w-full overflow-hidden"
          style={{ height: dynamicHeight }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart
              accessibilityLayer={false}
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                className="text-xs"
                tick={{ fontSize: 11 }}
                tickMargin={8}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="stage"
                className="text-xs"
                tick={{ fontSize: 11 }}
                width={84}
                tickMargin={6}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [value, "Leads"]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                {chartData.map((entry) => (
                  <Cell key={entry.stage} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
