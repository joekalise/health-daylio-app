import { db } from "@/db";
import { stravaTokens, workouts } from "@/db/schema";
import { eq } from "drizzle-orm";

interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  type: string;
  start_date_local: string;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  calories?: number;
}

export async function getStravaToken() {
  const [token] = await db.select().from(stravaTokens).limit(1);
  return token ?? null;
}

export async function getValidAccessToken(): Promise<string | null> {
  const token = await getStravaToken();
  if (!token) return null;

  // Return existing token if it has > 5 min left
  if (Date.now() / 1000 < token.expiresAt - 300) return token.accessToken;

  // Refresh
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: token.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();

  await db.update(stravaTokens).set({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    updatedAt: new Date(),
  }).where(eq(stravaTokens.id, token.id));

  return data.access_token as string;
}

export async function syncStravaActivities(days = 30): Promise<number> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error("Not connected to Strava");

  const after = Math.floor(Date.now() / 1000) - days * 86400;
  let page = 1;
  let totalSynced = 0;

  while (true) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=100&after=${after}&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) break;

    const activities: StravaActivity[] = await res.json();
    if (!activities.length) break;

    for (const a of activities) {
      const row = {
        stravaId: String(a.id),
        date: a.start_date_local.split("T")[0],
        name: a.name,
        sportType: a.sport_type ?? a.type,
        durationSecs: a.moving_time,
        distanceMeters: a.distance || null,
        elevationGain: a.total_elevation_gain || null,
        avgHeartrate: a.average_heartrate ?? null,
        calories: a.calories ?? null,
      };
      await db.insert(workouts).values(row).onConflictDoUpdate({
        target: [workouts.stravaId],
        set: {
          name: row.name,
          durationSecs: row.durationSecs,
          distanceMeters: row.distanceMeters,
          elevationGain: row.elevationGain,
          avgHeartrate: row.avgHeartrate,
          calories: row.calories,
        },
      });
    }

    totalSynced += activities.length;
    if (activities.length < 100) break;
    page++;
  }

  return totalSynced;
}
