// lib/middleware/rate-limit.ts - COMPLETE FILE WITH FIXED TYPES
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory store - consider using Redis in production
const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  skipPaths?: string[];
}

export function rateLimitMiddleware(
  request: NextRequest,
  options: RateLimitOptions = {}
) {
  const {
    windowMs = 60 * 1000, // 1 minute default
    maxRequests = 60, // 60 requests per minute default
    skipPaths = ["/api/health", "/api/test", "/api/test-env", "/api/hello"],
  } = options;

  const pathname = request.nextUrl.pathname;
  
  // Skip rate limiting for certain paths
  if (skipPaths.some(path => pathname.startsWith(path))) {
    return null;
  }

  // ✅ FIX: Get client identifier safely - NextRequest doesn't have 'ip' directly
  // Use headers or x-forwarded-for instead
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || 
             request.headers.get("x-real-ip") || 
             "anonymous";
  
  const key = `${ip}:${pathname}`;
  const now = Date.now();
  
  const record = rateLimitStore.get(key);
  
  if (record) {
    if (now > record.resetAt) {
      // Reset window
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return null;
    }
    
    if (record.count >= maxRequests) {
      return NextResponse.json(
        { 
          error: "Too many requests. Please try again later.",
          retryAfter: Math.ceil((record.resetAt - now) / 1000),
        },
        { 
          status: 429,
          headers: {
            "Retry-After": Math.ceil((record.resetAt - now) / 1000).toString(),
          },
        }
      );
    }
    
    record.count++;
  } else {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
  }
  
  return null;
}