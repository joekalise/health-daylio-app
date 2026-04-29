import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

function getWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return webpush;
}

export async function sendToAll(payload: { title: string; body: string; url?: string; tag?: string }) {
  const wp = getWebPush();
  const subs = await db.select().from(pushSubscriptions);
  const results = await Promise.allSettled(
    subs.map((s) =>
      wp.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      )
    )
  );
  // Remove expired/invalid subscriptions
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "rejected" || (r.status === "fulfilled" && [404, 410].includes((r.value as any).statusCode))) {
      await db.delete(pushSubscriptions).where(
        (await import("drizzle-orm")).eq(pushSubscriptions.endpoint, subs[i].endpoint)
      );
    }
  }
}
