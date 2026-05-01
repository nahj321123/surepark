import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebaseAdmin"

// GET all slots
export async function GET() {
  const snapshot = await db.ref("slots").once("value")

  return NextResponse.json(snapshot.val() || {}, {
    headers: { "Cache-Control": "no-store" },
  })
}

// RESERVE SLOT (SAFE — NO OVERWRITE)
export async function POST(req: NextRequest) {
  const { slotId, userId } = await req.json()

  if (!slotId || !userId) {
    return NextResponse.json(
      { ok: false, error: "slotId + userId required" },
      { status: 400 }
    )
  }

  const ref = db.ref(`slots/${slotId}`)

  const result = await ref.transaction((slot) => {
    if (!slot) {
      return {
        status: "reserved",
        reservedBy: userId,
        paid: false,
        bollardUp: false,
      }
    }

    // 🔒 LOCK
    if (slot.status !== "available") {
      return // abort transaction
    }

    return {
      ...slot,
      status: "reserved",
      reservedBy: userId,
      reservedAt: Date.now(),
    }
  })

  if (!result.committed) {
    return NextResponse.json({ ok: false, error: "Slot already taken" })
  }

  return NextResponse.json({ ok: true, slot: result.snapshot.val() })
}