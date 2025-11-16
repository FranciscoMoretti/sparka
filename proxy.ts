import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

function shouldSkipRequest(pathname: string): boolean {
  const isApiAuthRoute = pathname.startsWith("/api/auth");
  const isMetadataRoute =
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.webmanifest";
  const isTrpcApi = pathname.startsWith("/api/trpc");
  const isChatApiRoute = pathname === "/api/chat";

  return isApiAuthRoute || isMetadataRoute || isTrpcApi || isChatApiRoute;
}

type PageContext = {
  isOnChat: boolean;
  isOnModels: boolean;
  isOnCompare: boolean;
  isOnLoginPage: boolean;
  isOnRegisterPage: boolean;
  isOnSharePage: boolean;
  isOnPrivacyPage: boolean;
  isOnTermsPage: boolean;
};

function getPageContext(pathname: string): PageContext {
  return {
    isOnChat: pathname.startsWith("/"),
    isOnModels: pathname.startsWith("/models"),
    isOnCompare: pathname.startsWith("/compare"),
    isOnLoginPage: pathname.startsWith("/login"),
    isOnRegisterPage: pathname.startsWith("/register"),
    isOnSharePage: pathname.startsWith("/share/"),
    isOnPrivacyPage: pathname.startsWith("/privacy"),
    isOnTermsPage: pathname.startsWith("/terms"),
  };
}

function getRedirectResponse(
  pageContext: PageContext,
  isLoggedIn: boolean,
  url: URL
): NextResponse | undefined {
  const {
    isOnChat,
    isOnModels,
    isOnCompare,
    isOnLoginPage,
    isOnRegisterPage,
    isOnSharePage,
    isOnPrivacyPage,
    isOnTermsPage,
  } = pageContext;

  if (isLoggedIn && (isOnLoginPage || isOnRegisterPage)) {
    return NextResponse.redirect(new URL("/", url));
  }

  const isPublicPage =
    isOnRegisterPage ||
    isOnLoginPage ||
    isOnSharePage ||
    isOnModels ||
    isOnCompare ||
    isOnPrivacyPage ||
    isOnTermsPage;

  if (isPublicPage) {
    return;
  }

  if (isOnChat) {
    if (url.pathname === "/" || isLoggedIn) {
      return;
    }
    return NextResponse.redirect(new URL("/login", url));
  }

  if (isLoggedIn) {
    return NextResponse.redirect(new URL("/", url));
  }
}

export async function proxy(req: NextRequest) {
  // Mirror previous authorized() logic using Better Auth session
  const url = req.nextUrl;

  if (shouldSkipRequest(url.pathname)) {
    return;
  }

  const session = await auth.api.getSession({ headers: req.headers });
  const isLoggedIn = !!session?.user;

  const pageContext = getPageContext(url.pathname);
  return getRedirectResponse(pageContext, isLoggedIn, url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, opengraph-image (favicon and og image)
     * - manifest files (.json, .webmanifest)
     * - Images and other static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico)
     * - models
     * - compare
     */
    "/((?!api|_next/static|_next/image|favicon.ico|opengraph-image|manifest|models|compare|privacy|terms|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest)$).*)",
  ],
};
