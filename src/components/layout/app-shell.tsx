"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { useTenant } from "@/components/providers/tenant-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { userName, userEmail } = useTenant();

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
