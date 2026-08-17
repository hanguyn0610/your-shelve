import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";

export async function POST() {
  // httpOnly cookies can't be cleared by client-side JS — this is what a "logout"
  // has to call now instead of just deleting a cookie in the browser.
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}
