import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { requireCsrfHeader } from "@/lib/security/csrf";

export async function POST(request: Request) {
  // No session check to hang this off of here (logout works even with a stale/expired
  // token), so — like login/register — the CSRF check just goes first.
  if (!requireCsrfHeader(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  }

  // httpOnly cookies can't be cleared by client-side JS — this is what a "logout"
  // has to call now instead of just deleting a cookie in the browser.
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}
