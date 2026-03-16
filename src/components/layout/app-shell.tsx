"use client";

import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { createClient } from "@/lib/supabase/client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserEmail(user.email || "");

        const { data: crmUser } = await supabase
          .from("crm_users")
          .select("name")
          .eq("id", user.id)
          .single();

        setUserName(crmUser?.name || null);
      }
    }
    loadUser();
  }, []);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AppHeader
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          userName={userName}
          userEmail={userEmail}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
