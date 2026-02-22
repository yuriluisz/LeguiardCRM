"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/providers/tenant-provider";

export function useNewLeadsCount(): number {
  const [count, setCount] = useState(0);
  const { selectedTenant } = useTenant();

  const fetchCount = useCallback(async () => {
    if (!selectedTenant) return;

    const lastLogin = localStorage.getItem("lastLoginAt");
    if (!lastLogin) return;

    try {
      const supabase = createClient();

      // Leads novos desde o último login
      const { count: newCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", selectedTenant.id)
        .or(`created_at.gte.${lastLogin},last_interaction.gte.${lastLogin}`);

      setCount(newCount || 0);
    } catch (error) {
      console.error("Erro ao buscar novos leads:", error);
    }
  }, [selectedTenant]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return count;
}
