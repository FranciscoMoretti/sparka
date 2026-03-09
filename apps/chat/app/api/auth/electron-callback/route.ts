import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

// Creates a short-lived signed token encoding the session token.
// Stateless: signed with AUTH_SECRET so no DB or shared-memory store is needed.
function createSignedToken(sessionToken: string): string {
  const payload = Buffer.from(
    JSON.stringify({ s: sessionToken, exp: Date.now() + 60_000 })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", env.AUTH_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get("better-auth.session_token")?.value;

  if (!sessionToken) {
    return new NextResponse("No active session found after OAuth.", {
      status: 400,
    });
  }

  const token = createSignedToken(sessionToken);
  const successUrl = new URL("/electron-auth/success", request.url);
  successUrl.searchParams.set("token", token);
  return NextResponse.redirect(successUrl);
}
