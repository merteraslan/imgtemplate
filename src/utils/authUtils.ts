import { validateToken } from '../app/api/validate-session/route';

// Re-export the token validation function for use in other API routes
export { validateToken };

// Check if a session token is valid
export function isValidSessionToken(token: string | null): boolean {
  return validateToken(token);
} 