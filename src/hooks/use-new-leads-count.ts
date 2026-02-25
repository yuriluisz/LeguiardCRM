"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/components/providers/tenant-provider";

export function useNewLeadsCount(): number {
  // Feature removed: always return 0
  return 0;
}
