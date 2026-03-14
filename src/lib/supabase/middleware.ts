import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

  const publicPaths = ["/login", "/auth/callback", "/auth/update-password", "/api/onboard"];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  const isApiPath = request.nextUrl.pathname.startsWith("/api/");

  let user: { id: string } | null = null;
  try {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // Em instabilidade de rede do Supabase, não derrubar sessão por falso negativo.
      console.warn("Falha ao validar sessão no middleware:", error.message);
    } else {
      user = authUser as { id: string } | null;
    }
  } catch (error) {
    // Fail-soft para não liberar rota protegida em erro transitório de auth provider.
    console.warn("Erro transitório ao buscar usuário no middleware:", error);
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
    return NextResponse.redirect(url);
  }

  if (user && !isPublicPath) {
    // Verificar se o usuário está ativo na tabela crm_users
    const { data: crmUser, error: crmUserError } = await supabase
      .from("crm_users")
      .select("active")
      .eq("id", user.id)
      .maybeSingle();

    if (crmUserError) {
      // Fail-soft: não liberar rota protegida quando auth store está indisponível.
      console.warn("Falha ao validar crm_users no middleware:", crmUserError.message);
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
      return NextResponse.redirect(url);
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
