export { auth as proxy } from "@/lib/auth";

export const config = {
  matcher: ["/((?!api/auth|api/health/ingest|_next/static|_next/image|favicon.ico).*)"],
};
