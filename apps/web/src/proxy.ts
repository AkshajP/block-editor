import { auth } from "@block-editor/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth && !req.nextUrl.pathname.startsWith("/api/")) {
    const signInUrl = new URL("/api/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
