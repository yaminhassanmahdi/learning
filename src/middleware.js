import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // If user is authenticated and trying to access login or landing page, redirect to dashboard
  if (session && (pathname === '/login' || pathname === '/landing')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // If user is not authenticated and trying to access protected routes, redirect to landing
  if (!session && pathname !== '/login' && pathname !== '/landing' && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/landing', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}; 