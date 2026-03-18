"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TimeSeriesChartProps {
  title: string;
  data: { date: string; count: number }[];
  valueLabel?: string;
  color?: string; // hex
  description?: string;
}

export function TimeSeriesChart({ title, data, valueLabel = "Contagem", color = "#3b82f6", description }: TimeSeriesChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    dateLabel: format(parseISO(item.date), "dd/MM", { locale: ptBR }),
  }));
  const gradientId = `grad_${title.replace(/\W/g, "_")}`;
  // render description verbatim (no trimming)

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="dashboard-chart h-56 w-full overflow-hidden sm:h-64"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              accessibilityLayer={false}
              data={formattedData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="dateLabel"
                className="text-xs"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={24}
                tickMargin={8}
              />
              <YAxis
                className="text-xs"
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                width={28}
                tickMargin={6}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(label) => `Data: ${label}`}
                formatter={(value) => [value, valueLabel]}
              />
              <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#${gradientId})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
