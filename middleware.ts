// middleware.ts - COMPLETE FILE
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

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

// API routes that should be rate limited
const apiRoutes = ["/api/auth", "/api/leave", "/api/hod", "/api/registrar", "/api/principal"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // ✅ Apply rate limiting to API routes
  if (apiRoutes.some(route => pathname.startsWith(route))) {
    const rateLimitResponse = rateLimitMiddleware(request, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 requests per minute
      skipPaths: [
        "/api/health", 
        "/api/test", 
        "/api/test-env", 
        "/api/hello",
        "/api/leave-types", // Public endpoint
      ],
    });
    
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }
  
  // ✅ Skip middleware for API routes (but after rate limiting)
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
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};