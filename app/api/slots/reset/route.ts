import { NextResponse } from "next/server"
import { slotStore } from "@/lib/store"

export async function POST() {
  const slots = slotStore.reset()
  return NextResponse.json({ ok: true, slots })
}
