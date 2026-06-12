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
  
  // ✅ FIX: Check for 'session' cookie (not 'unileave-session')
  const session = request.cookies.get("session")?.value;
  const isAuthenticated = !!session;
  
  console.log(`[Proxy] Path: ${pathname}, Authenticated: ${isAuthenticated}`);
  
  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Protect routes that start with protected paths
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      console.log(`[Proxy] Redirecting to: ${url.toString()}`);
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};