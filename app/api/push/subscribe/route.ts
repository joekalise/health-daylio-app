import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await req.json();
  const endpoint: string = sub.endpoint;
  const p256dh: string = sub.keys?.p256dh;
  const authKey: string = sub.keys?.auth;

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await db.insert(pushSubscriptions)
    .values({ endpoint, p256dh, auth: authKey })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh, auth: authKey } });

  return NextResponse.json({ ok: true });
}
