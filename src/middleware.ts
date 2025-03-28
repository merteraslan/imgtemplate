import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiting (resets on server restart)
// For production, consider using a Redis-based solution
const rateLimit = {
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Max 20 requests per minute
  message: 'Too many requests, please try again later.'
};

// In-memory store for API requests
const ipRequestMap = new Map<string, { count: number; resetTime: number }>();

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (pathname.startsWith('/api/')) {
    // Get client IP from headers or fallback to a default value
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const now = Date.now();
    
    // Get or initialize rate limit data
    const rateLimitData = ipRequestMap.get(ip) || { 
      count: 0, 
      resetTime: now + rateLimit.windowMs 
    };
    
    // Reset count if window expired
    if (now > rateLimitData.resetTime) {
      rateLimitData.count = 0;
      rateLimitData.resetTime = now + rateLimit.windowMs;
    }
    
    // Increment request count
    rateLimitData.count++;
    
    // Save updated data
    ipRequestMap.set(ip, rateLimitData);
    
    // Apply rate limiting
    if (rateLimitData.count > rateLimit.max) {
      return new NextResponse(JSON.stringify({ error: rateLimit.message }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimit.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitData.resetTime / 1000).toString()
        }
      });
    }
    
    // Add rate limit headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', rateLimit.max.toString());
    response.headers.set('X-RateLimit-Remaining', 
      Math.max(0, rateLimit.max - rateLimitData.count).toString());
    response.headers.set('X-RateLimit-Reset', 
      Math.ceil(rateLimitData.resetTime / 1000).toString());
    
    return response;
  }
  
  return NextResponse.next();
}

// Only run middleware on API routes
export const config = {
  matcher: '/api/:path*',
}; 