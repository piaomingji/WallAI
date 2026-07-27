import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const keys = Array.from(requestHeaders.keys());

  let modified = false;

  for (const key of keys) {
    const val = requestHeaders.get(key) || '';
    let hasNonAscii = false;
    for (let i = 0; i < val.length; i++) {
      if (val.charCodeAt(i) > 255) {
        hasNonAscii = true;
        break;
      }
    }

    if (hasNonAscii) {
      console.warn(`[Proxy] Removing header "${key}" containing non-ASCII characters:`, val);
      // Delete the header to prevent Node.js fetch propagation crashes
      requestHeaders.delete(key);
      modified = true;
    }
  }

  if (modified) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

// Apply proxy to API routes
export const config = {
  matcher: '/api/:path*',
};
