import { NextResponse, type NextRequest } from 'next/server';

// First gate only: every admin/staff page and action re-checks the session in the database.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (/^\/(admin|staff)(\/|$)/.test(pathname) && !req.cookies.has('bolt_session')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    `default-src 'self'`, `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? ` 'unsafe-eval'` : ''}`,
    `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`, `font-src 'self' data:`, `connect-src 'self'${dev ? ' ws:' : ''}`,
    `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`,
  ].join('; ');
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon|icon|api/).*)'] };
