"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import Image from "next/image";

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
  const [tokenUser, setTokenUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const errorParam = searchParams.get("error");
  const inviteCode = searchParams.get("code");
  const isInvite = Boolean(inviteCode);
  const tokenParam = searchParams.get("token");
  const isOnboard = Boolean(tokenParam);

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

      window.location.replace("/dashboard");
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

      window.location.replace("/dashboard");
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function validateToken() {
      if (!tokenParam) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/onboard/validate?token=${encodeURIComponent(tokenParam)}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json?.error || "Token inválido ou expirado.");
          return;
        }
        const data = await res.json();
        setTokenUser({ id: data.id, email: data.email, name: data.name });
      } catch {
        setError("Erro ao validar token.");
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [tokenParam]);

  async function handleCompleteOnboarding(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!tokenParam || !tokenUser) {
      setError("Token inválido.");
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError("Senha deve ter ao menos 8 caracteres.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/onboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenParam, user_id: tokenUser.id, new_password: newPassword }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Falha ao completar cadastro.");
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: tokenUser.email,
        password: newPassword,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      window.location.replace("/dashboard");
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-6 sm:py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Image
              src="/favicon-96x96.png"
              alt="Leguiard CRM"
              width={64}
              height={64}
              className="rounded-xl"
              priority
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Leguiard CRM</CardTitle>
            <CardDescription>Entre com suas credenciais para acessar o sistema</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isOnboard ? (
            <form onSubmit={handleCompleteOnboarding} className="space-y-4">
              {(error || errorParam === "inactive") && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {errorParam === "inactive" ? "Sua conta está desativada." : error}
                </div>
              )}

              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input value={tokenUser?.email || ""} readOnly />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirme a senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar senha
              </Button>
            </form>
          ) : isInvite ? (
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
