import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// In-memory token store (resets on server restart)
// For production, consider using a database or Redis
interface SessionToken {
  token: string;
  expires: number;
}

const SESSION_TOKENS = new Map<string, SessionToken>();

// Generate a random token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Clean expired tokens
function cleanExpiredTokens() {
  const now = Date.now();
  for (const [key, value] of SESSION_TOKENS.entries()) {
    if (value.expires < now) {
      SESSION_TOKENS.delete(key);
    }
  }
}

// Token validation helper that can be imported by other API routes
export function validateToken(token: string | null): boolean {
  if (!token) return false;
  
  cleanExpiredTokens();
  
  const sessionToken = SESSION_TOKENS.get(token);
  return !!sessionToken && sessionToken.expires > Date.now();
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate with API key
    const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '') || 
                 req.headers.get('X-API-Key');
    
    const validApiKey = process.env.API_KEY;
    
    if (!validApiKey) {
      console.error('API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    if (!apiKey || apiKey !== validApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Generate a new session token
    const token = generateToken();
    
    // Token valid for 1 hour
    const expires = Date.now() + 60 * 60 * 1000;
    
    // Store token
    SESSION_TOKENS.set(token, { token, expires });
    
    // Clean expired tokens
    cleanExpiredTokens();
    
    // Return token to client
    return NextResponse.json({ token, expires });
  } catch (error) {
    console.error('Error in session validation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 