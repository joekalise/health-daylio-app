import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { stravaTokens } from "@/db/schema";
import { syncStravaActivities } from "@/lib/strava";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL("/api/auth/signin", req.url));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const callbackUrl = new URL("/api/strava/callback", req.url).toString();
  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      redirect_uri: callbackUrl,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) return NextResponse.redirect(new URL("/dashboard", req.url));
  const data = await tokenRes.json();
  if (!data.access_token) return NextResponse.redirect(new URL("/dashboard", req.url));

  await db.insert(stravaTokens).values({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteId: data.athlete.id,
    athleteName: `${data.athlete.firstname} ${data.athlete.lastname}`.trim(),
    athletePhoto: data.athlete.profile_medium ?? null,
  }).onConflictDoUpdate({
    target: [stravaTokens.athleteId],
    set: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      athleteName: `${data.athlete.firstname} ${data.athlete.lastname}`.trim(),
      athletePhoto: data.athlete.profile_medium ?? null,
      updatedAt: new Date(),
    },
  });

  // Initial sync — last 6 months
  try { await syncStravaActivities(180); } catch { /* non-fatal */ }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
