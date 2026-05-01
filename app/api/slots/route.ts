import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebaseAdmin"

// ✅ GET all slots (clean + safe)
export async function GET() {
  const snapshot = await db.ref("slots").once("value")
  const data = snapshot.val() || {}

  // 🔥 Ensure consistent structure (prevents frontend crash)
  const cleaned: any = {}

  Object.keys(data).forEach((key) => {
    cleaned[key] = {
      status: data[key]?.status || "available",
      reservedBy: data[key]?.reservedBy || null,
      reservedAt: data[key]?.reservedAt || null,
      paid: data[key]?.paid || false,
      bollardUp: data[key]?.bollardUp || false,
      checkedIn: data[key]?.checkedIn || false,
    }
  })

  return NextResponse.json(cleaned, {
    headers: { "Cache-Control": "no-store" },
  })
}

// ✅ RESERVE SLOT (SAFE — NO OVERWRITE)
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
        reservedAt: Date.now(),
        paid: false,
        bollardUp: false,
        checkedIn: false,
      }
    }

    // 🔒 LOCK: prevent overwrite
    if (slot.status !== "available") {
      return // abort
    }

    return {
      ...slot,
      status: "reserved",
      reservedBy: userId,
      reservedAt: Date.now(),
    }
  })

  if (!result.committed) {
    return NextResponse.json(
      { ok: false, error: "Slot already taken" },
      { status: 409 }
    )
  }

  return NextResponse.json({
    ok: true,
    slot: result.snapshot.val(),
  })
}