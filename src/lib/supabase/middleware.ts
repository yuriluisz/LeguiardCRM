import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const CRM_ACTIVE_COOKIE = "crm_user_active";
const CRM_ACTIVE_COOKIE_TTL_SECONDS = 60 * 5;

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => {
    const name = cookie.name;
    return (
      name.endsWith("-auth-token") ||
      name.includes("-auth-token.") ||
      name.includes("-auth-token-code-verifier")
    );
  });
}

function hasActiveCrmUserCookie(request: NextRequest, userId: string): boolean {
  return request.cookies.get(CRM_ACTIVE_COOKIE)?.value === userId;
}

function setActiveCrmUserCookie(response: NextResponse, userId: string) {
  response.cookies.set(CRM_ACTIVE_COOKIE, userId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: CRM_ACTIVE_COOKIE_TTL_SECONDS,
  });
}

function clearActiveCrmUserCookie(response: NextResponse) {
  response.cookies.set(CRM_ACTIVE_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

export async function updateSession(request: NextRequest) {
  const publicPaths = ["/login", "/auth/callback", "/auth/update-password", "/api/onboard"];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isApiPath = request.nextUrl.pathname.startsWith("/api/");
  const hasAuthCookie = hasSupabaseAuthCookie(request);

  let supabaseResponse = NextResponse.next({
    request,
  });

  // Keep the no-cookie fast path for public/API routes, but protected pages still
  // need the server-side Supabase client so session cookies are normalized before
  // the React Server Components tree runs.
  if (!hasAuthCookie && (isPublicPath || isApiPath)) {
    return supabaseResponse;
  }

  if (!hasAuthCookie && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const supabaseUrl =
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabase = createServerClient(
    supabaseUrl!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user: { id: string } | null = null;
  try {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      const isMissingSession = error.message
        ?.toLowerCase()
        .includes("auth session missing");

      // Reduce noisy logs in production for expected missing-session cases.
      if (!isMissingSession && process.env.NODE_ENV !== "production") {
        console.warn("Falha ao validar sessão no middleware:", error.message);
      }
    } else {
      user = authUser as { id: string } | null;
    }
  } catch (error) {
    // Fail-soft para não liberar rota protegida em erro transitório de auth provider.
    if (process.env.NODE_ENV !== "production") {
      console.warn("Erro transitório ao buscar usuário no middleware:", error);
    }
    if (isPublicPath) {
      return supabaseResponse;
    }

    if (isApiPath) {
      return NextResponse.json(
        { error: "Serviço de autenticação temporariamente indisponível" },
        { status: 503 }
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "auth_unavailable");
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    clearActiveCrmUserCookie(redirectResponse);
    return redirectResponse;
  }

  if (user && !isPublicPath) {
    if (hasActiveCrmUserCookie(request, user.id)) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[middleware] crm_users cache hit", { userId: user.id });
      }
    } else {
    // Verificar se o usuário está ativo na tabela crm_users
      const { data: crmUser, error: crmUserError } = await supabase
        .from("crm_users")
        .select("active")
        .eq("id", user.id)
        .maybeSingle();

      if (process.env.NODE_ENV !== "production") {
        console.debug("[middleware] acesso crm_users validado", {
          userId: user.id,
          hasCrmUser: Boolean(crmUser),
        });
      }

      if (crmUserError) {
        // Fail-soft: não liberar rota protegida quando auth store está indisponível.
        if (process.env.NODE_ENV !== "production") {
          console.warn("Falha ao validar crm_users no middleware:", crmUserError.message);
        }
        if (isApiPath) {
          return NextResponse.json(
            { error: "Serviço de autenticação temporariamente indisponível" },
            { status: 503 }
          );
        }

        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        url.searchParams.set("error", "auth_unavailable");
        return NextResponse.redirect(url);
      }

      if (!crmUser || !crmUser.active) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        url.searchParams.set("error", "inactive");
        const redirectResponse = NextResponse.redirect(url);
        clearActiveCrmUserCookie(redirectResponse);
        return redirectResponse;
      }

      setActiveCrmUserCookie(supabaseResponse, user.id);
    }
  }

  // Se logado e acessando login, redirecionar para dashboard
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
