import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendToAll } from "@/lib/push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export async function POST() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) {
    return NextResponse.json({ ok: false, error: "No subscriptions in database — try re-enabling notifications" }, { status: 400 });
  }

  try {
    await sendToAll({
      title: "Test notification",
      body: "Push notifications are working correctly.",
      url: "/dashboard",
      tag: "test",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
