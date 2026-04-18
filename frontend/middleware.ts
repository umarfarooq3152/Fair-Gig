import { NextRequest, NextResponse } from 'next/server';

const roleRoutes: Record<string, string[]> = {
  worker: ['/dashboard', '/shifts', '/certificate', '/community'],
  verifier: ['/queue', '/verifier'],
  advocate: ['/advocate', '/community'],
};

function decodeRoleFromToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));
    return decoded.role || null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('fairgig_access_token')?.value;
  const role = decodeRoleFromToken(token);

  if (!role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const allowedPrefixes = roleRoutes[role] || [];
  const allowed = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!allowed) {
    if (role === 'worker') return NextResponse.redirect(new URL('/dashboard', request.url));
    if (role === 'verifier') return NextResponse.redirect(new URL('/queue', request.url));
    if (role === 'advocate') return NextResponse.redirect(new URL('/advocate/analytics', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
