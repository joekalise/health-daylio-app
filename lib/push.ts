import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

function getWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
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
  // Only remove subscriptions that are definitively gone (404/410) — not on transient errors
  const { eq } = await import("drizzle-orm");
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const statusCode = r.status === "fulfilled" ? (r.value as any).statusCode : (r.reason as any)?.statusCode;
    if ([404, 410].includes(statusCode)) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subs[i].endpoint));
    }
  }
}
