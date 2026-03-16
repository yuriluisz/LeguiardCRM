"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TenantSelector } from "./tenant-selector";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, Moon, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface AppHeaderProps {
  onMenuToggle: () => void;
  userName?: string | null;
  userEmail?: string;
}

export function AppHeader({ onMenuToggle, userName, userEmail }: AppHeaderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userEmail?.slice(0, 2).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background px-3 sm:gap-3 sm:px-4 lg:gap-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Tenant Selector */}
      <div className="min-w-0 flex-1">
        <TenantSelector />
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-1rem)]">
            <div className="flex items-center gap-2 p-2">
              <div className="flex flex-col space-y-0.5">
                {userName && (
                  <p className="max-w-44 truncate text-sm font-medium">{userName}</p>
                )}
                {userEmail && (
                  <p className="max-w-44 truncate text-xs text-muted-foreground">{userEmail}</p>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
