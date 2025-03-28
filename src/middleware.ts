import { NextRequest, NextResponse } from 'next/server';

// This middleware runs on all API routes
export const config = {
  matcher: '/api/:path*',
};

export function middleware(request: NextRequest) {
  // Skip middleware for the standalone API function which has its own validation
  if (request.nextUrl.pathname === '/api/generate-image') {
    return NextResponse.next();
  }
  
  // Get the API key from environment variable
  const apiKey = process.env.API_KEY;

  // Skip validation if API_KEY is not set (for development)
  if (!apiKey) {
    console.warn('API_KEY environment variable not set. API routes are unprotected.');
    return NextResponse.next();
  }

  // Check if the request has the correct API key in the header
  const authHeader = request.headers.get('authorization');
  
  // Expected format: "Bearer YOUR_API_KEY"
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== apiKey) {
    // Return 401 Unauthorized if API key is missing or invalid
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized: Invalid API key' }),
      { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
  
  // Continue with the request if API key is valid
  return NextResponse.next();
} 