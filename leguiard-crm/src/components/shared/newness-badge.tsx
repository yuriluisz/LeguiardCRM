"use client";

import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface NewnessBadgeProps {
  createdAt: string;
  lastInteraction: string | null;
  lastLoginAt: string | null;
}

export function NewnessBadge({
  createdAt,
  lastInteraction,
  lastLoginAt,
}: NewnessBadgeProps) {
  if (!lastLoginAt) return null;

  const loginDate = new Date(lastLoginAt);
  const isNew =
    new Date(createdAt) > loginDate ||
    (lastInteraction && new Date(lastInteraction) > loginDate);

  if (!isNew) return null;

  return (
    <Badge
      variant="secondary"
      className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    >
      <Sparkles className="h-3 w-3" />
      Novo
    </Badge>
  );
}
