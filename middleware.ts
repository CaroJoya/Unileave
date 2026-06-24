// middleware.ts - ADD CACHING
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip for API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }
  
  // Skip for static files
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon.ico") || pathname.includes(".")) {
    return NextResponse.next();
  }
  
  // Check for 'session' cookie
  const session = request.cookies.get("session")?.value;
  const isAuthenticated = !!session;
  
  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    const response = NextResponse.next();
    
    // ✅ Add caching for public routes
    if (pathname === "/login") {
      response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    }
    
    return response;
  }
  
  // Protect routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }
  
  const response = NextResponse.next();
  
  // ✅ Cache static assets
  if (pathname.startsWith("/_next/static")) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};