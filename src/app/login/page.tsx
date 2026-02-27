"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const errorParam = searchParams.get("error");
  const inviteCode = searchParams.get("code");
  const isInvite = Boolean(inviteCode);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Email ou senha inválidos.");
        } else {
          setError(authError.message);
        }
        return;
      }

      // Verificar se o usuário é um crm_user ativo
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Erro ao obter dados do usuário.");
        return;
      }

      const { data: crmUser } = await supabase
        .from("crm_users")
        .select("active")
        .eq("id", user.id)
        .single();

      if (!crmUser) {
        await supabase.auth.signOut();
        setError("Usuário não autorizado para acessar o CRM.");
        return;
      }

      if (!crmUser.active) {
        await supabase.auth.signOut();
        setError("Sua conta está desativada. Entre em contato com o administrador.");
        return;
      }

      // removed: do not store lastLoginAt for 'new since last login' feature

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Digite seu email primeiro.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setError(null);
      alert("Email de recuperação enviado! Verifique sua caixa de entrada.");
    } catch {
      setError("Erro ao enviar email de recuperação.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const code = inviteCode;
      if (!code) {
        setError("Código de convite inválido.");
        return;
      }

      const supabase = createClient();

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: invitePassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Leguiard CRM</CardTitle>
          <CardDescription>Entre com suas credenciais para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {isInvite ? (
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              {(error || errorParam === "inactive") && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errorParam === "inactive"
                  ? "Sua conta está desativada."
                  : error}
              </div>
            )}
              <div className="space-y-2">
                <Label htmlFor="invitePassword">Crie sua nova senha</Label>
                <Input
                  id="invitePassword"
                  type="password"
                  placeholder="••••••••"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar e Acessar
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {(error || errorParam === "inactive") && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {errorParam === "inactive" ? "Sua conta está desativada." : error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full text-sm"
                onClick={handleForgotPassword}
                disabled={loading}
              >
                Esqueci minha senha
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
