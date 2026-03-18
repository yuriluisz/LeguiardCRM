"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Columns3,
  MessageSquare,
  Workflow,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/components/providers/tenant-provider";

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/conversations",
    label: "Conversas",
    icon: MessageSquare,
  },
  {
    href: "/kanban",
    label: "Kanban",
    icon: Columns3,
  },
  {
    href: "/followup",
    label: "Follow-up",
    icon: Workflow,
  },
];

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedTenant } = useTenant();
  const isBronzeTenant = String(selectedTenant?.plan_level || "").toLowerCase() === "bronze";
  const availableNavItems = isBronzeTenant
    ? navItems.filter((item) => item.href !== "/followup")
    : navItems;

  useEffect(() => {
    for (const item of availableNavItems) {
      router.prefetch(item.href);
    }
  }, [availableNavItems, router]);

  return (
    <>
      {/* Backdrop mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header do sidebar */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/favicon-96x96.png"
              alt="Leguiard CRM"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-lg font-bold">Leguiard CRM</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 space-y-1 p-3">
          {availableNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                onMouseEnter={() => router.prefetch(item.href)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-3">
          <p className="text-xs text-sidebar-foreground/50 text-center">
            Leguiard CRM v1.8
          </p>
        </div>
      </aside>
    </>
  );
}
