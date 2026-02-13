import type { UserRole } from '@algreen/shared-types';

export interface JwtPayload {
  sub: string;
  email: string;
  tenant_id: string;
  process_id?: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  exp: number;
  iss: string;
  aud: string;
}

export function parseJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload) return true;
  // Add 30 second buffer
  return Date.now() >= (payload.exp * 1000) - 30000;
}
