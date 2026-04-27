import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    if (pathname === "/login" && token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        if (req.nextUrl.pathname === "/login") {
          return true;
        }

        const protectedPrefixes = [
          "/dashboard",
          "/stock",
          "/products",
          "/variations",
          "/users",
        ];
        const adminPrefixes = [
          "/stock/in",
          "/stock/history",
          "/products/new",
          "/products/",
          "/variations",
          "/users",
        ];
        const isProtected = protectedPrefixes.some((prefix) =>
          req.nextUrl.pathname.startsWith(prefix)
        );
        const isAdminOnly = adminPrefixes.some((prefix) =>
          req.nextUrl.pathname.startsWith(prefix)
        );

        if (isAdminOnly) {
          return token?.role === "ADMIN";
        }

        if (isProtected) {
          return !!token;
        }

        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/stock/:path*",
    "/products/:path*",
    "/variations/:path*",
    "/users/:path*",
    "/login",
  ],
};
