import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

function verifySignedToken(token: string): string | null {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  const expectedSig = crypto
    .createHmac("sha256", env.AUTH_SECRET)
    .update(payload)
    .digest("base64url");

  // Constant-time comparison to prevent timing attacks
  if (
    sig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    return null;
  }

  let parsed: { s: string; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }

  if (!parsed.s || parsed.exp < Date.now()) return null;

  return parsed.s;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const sessionToken = verifySignedToken(token);

  if (!sessionToken) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  return NextResponse.json({ sessionToken });
}
