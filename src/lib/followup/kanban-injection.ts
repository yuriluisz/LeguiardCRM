import type {
  AiConfigFollowup,
  FollowConfig,
  FollowKanbanColumnConfig,
} from "@/types/database";

const START_MARKER =
  "--- FOLLOW-UP CONFIG (auto-gerado — não edite esta seção) ---";
const END_MARKER = "--- FIM FOLLOW-UP CONFIG ---";

const WEEK_DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

function normalizeHour(input: string, fallback: string) {
  if (!input || typeof input !== "string") return fallback;
  const match = input.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function normalizeDays(input: number[] | undefined): number[] {
  if (!Array.isArray(input)) return [1, 2, 3, 4, 5];
  const deduped = [...new Set(input)]
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)
    .sort((a, b) => a - b);
  return deduped.length > 0 ? deduped : [1, 2, 3, 4, 5];
}

function normalizeColumns(
  input: FollowKanbanColumnConfig[] | undefined
): FollowKanbanColumnConfig[] {
  if (!Array.isArray(input)) return [];

  const byOrder = [...input]
    .filter((c) => c && typeof c === "object")
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

  const usedKeys = new Set<string>();
  let finalCount = 0;

  const normalized = byOrder.map((col, idx) => {
    const keyRaw = String(col.key ?? "").trim().toLowerCase();
    let key = keyRaw;
    if (!key || usedKeys.has(key)) {
      key = `etapa-${idx + 1}`;
      while (usedKeys.has(key)) {
        key = `${key}-x`;
      }
    }
    usedKeys.add(key);

    const label = String(col.label ?? "").trim() || `Etapa ${idx + 1}`;
    const aiDescription = String(col.ai_description ?? "").trim();
    const delay = Number(col.delay_hours ?? 0);
    const delayHours = Number.isFinite(delay) ? Math.max(0, delay) : 0;

    let isFinal = Boolean(col.is_final);
    if (isFinal) {
      finalCount += 1;
      if (finalCount > 1) {
        isFinal = false;
      }
    }

    return {
      key,
      label,
      order: idx + 1,
      ai_description: aiDescription,
      color: col.color ? String(col.color) : undefined,
      is_final: isFinal,
      delay_hours: delayHours,
    };
  });

  if (normalized.length > 0 && !normalized.some((c) => c.is_final)) {
    normalized[normalized.length - 1].is_final = true;
  }

  return normalized;
}

export function sanitizeFollowConfig(input: FollowConfig | null | undefined): FollowConfig {
  const columns = normalizeColumns(input?.kanban?.columns);
  const start = normalizeHour(input?.business_hours?.start ?? "", "08:00");
  const end = normalizeHour(input?.business_hours?.end ?? "", "22:00");
  const days = normalizeDays(input?.business_hours?.days);

  return {
    kanban: {
      columns,
    },
    business_hours: {
      start,
      end,
      days,
    },
  };
}

export function resolveFollowupInstructions(aiConfig: AiConfigFollowup | null | undefined): string {
  const instructions = aiConfig?.instructions;
  if (typeof instructions === "string" && instructions.trim().length > 0) {
    return instructions;
  }
  const legacy = aiConfig?.system_prompt;
  if (typeof legacy === "string") {
    return legacy;
  }
  return "";
}

function formatDays(days: number[]) {
  return days.map((d) => WEEK_DAY_LABELS[d] ?? `Dia ${d}`).join(", ");
}

export function buildFollowupPromptBlock(config: FollowConfig): string {
  const sorted = [...(config.kanban.columns ?? [])].sort((a, b) => a.order - b.order);
  const initial = sorted[0];
  const final = sorted.find((c) => c.is_final);

  const stepsText = sorted
    .map((stage, index) => {
      const finalLabel = stage.is_final ? " [ETAPA FINAL]" : "";
      return `${index + 1}. \"${stage.label}\" (key: \"${stage.key}\") - delay: ${stage.delay_hours}h${finalLabel} - ${stage.ai_description || "Sem descricao."}`;
    })
    .join("\n");

  const initialText = initial
    ? `Etapa inicial (ativa o follow-up): \"${initial.label}\" (key: \"${initial.key}\")`
    : "Etapa inicial (ativa o follow-up): não definida";

  const finalText = final
    ? `Etapa final (encerra o follow-up): \"${final.label}\" (key: \"${final.key}\")`
    : "Etapa final (encerra o follow-up): não definida";

  return [
    START_MARKER,
    "Etapas do pipeline de follow-up (em ordem):",
    stepsText || "(sem etapas)",
    "",
    initialText,
    finalText,
    "",
    `Horário comercial: ${config.business_hours.start} às ${config.business_hours.end}`,
    `Dias permitidos: ${formatDays(config.business_hours.days)}`,
    "",
    "Respeite o delay de cada etapa e só envie mensagens dentro do horário comercial.",
    END_MARKER,
  ].join("\n");
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function injectFollowupIntoPrompt(instructions: string, config: FollowConfig): string {
  const safeInstructions = typeof instructions === "string" ? instructions : "";
  const block = buildFollowupPromptBlock(config);

  const startRegex = escapeRegExp(START_MARKER);
  const endRegex = escapeRegExp(END_MARKER);
  const blockRegex = new RegExp(`${startRegex}[\\s\\S]*?${endRegex}`, "m");

  if (blockRegex.test(safeInstructions)) {
    return safeInstructions.replace(blockRegex, block).trim();
  }

  const trimmed = safeInstructions.trim();
  if (!trimmed) {
    return block;
  }

  return `${trimmed}\n\n${block}`;
}
