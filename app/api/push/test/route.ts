import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendToAll } from "@/lib/push";

export async function POST() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  await sendToAll({
    title: "Test notification",
    body: "Push notifications are working correctly.",
    url: "/dashboard",
    tag: "test",
  });

  return NextResponse.json({ ok: true });
}
