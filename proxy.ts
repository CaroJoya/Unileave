import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login", "/forgot-password", "/reset-password"];
const protectedRoutes = [
  "/dashboard",
  "/profile",
  "/request-leave",
  "/status",
  "/stats",
  "/comp-off",
  "/overwork",
  "/vacation",
  "/super-admin",
  "/headclerk",
  "/hod",
  "/registrar",
  "/principal",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if user is authenticated via cookie/session
  const session = request.cookies.get("unileave-session")?.value;
  const isAuthenticated = !!session;
  
  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Protect routes that start with protected paths
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};