"use client";

import type { CrmField } from "@/types/database";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CustomDataFieldsProps {
  fields: CrmField[];
  data: Record<string, unknown> | null;
}

export function CustomDataFields({ fields, data }: CustomDataFieldsProps) {
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum dado adicional registrado.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const value = data[field.key];
        const displayValue = formatFieldValue(value, field.type);

        return (
          <div key={field.key}>
            <p className="text-xs font-medium text-muted-foreground">
              {field.label}
            </p>
            <p className="text-sm">{displayValue}</p>
          </div>
        );
      })}
    </div>
  );
}

function formatFieldValue(
  value: unknown,
  type: string
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  switch (type) {
    case "number":
      return typeof value === "number"
        ? value.toLocaleString("pt-BR")
        : String(value);
    case "date":
      try {
        return format(parseISO(String(value)), "dd/MM/yyyy", { locale: ptBR });
      } catch {
        return String(value);
      }
    case "select":
    case "text":
    default:
      return String(value);
  }
}
