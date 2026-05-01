import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebaseAdmin"

// ✅ GET all slots (ARRAY FORMAT)
export async function GET() {
  try {
    const snapshot = await db.ref("slots").once("value")
    const data = snapshot.val() || {}

    const result = Object.keys(data).map((key) => ({
      id: Number(key),
      status: data[key]?.status || "available",
      reservedBy: data[key]?.reservedBy || null,
      reservedAt: data[key]?.reservedAt || null,
      paid: data[key]?.paid || false,
      bollardUp: data[key]?.bollardUp || false,
      checkedIn: data[key]?.checkedIn || false,
    }))

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (err) {
    console.error("GET /api/slots error:", err)
    return NextResponse.json([], { status: 200 })
  }
}

// ✅ RESERVE SLOT (SAFE — NO OVERWRITE)
export async function POST(req: NextRequest) {
  try {
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

      // 🔒 prevent overwrite
      if (slot.status !== "available") {
        return
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
      slot: {
        id: slotId,
        ...result.snapshot.val(),
      },
    })
  } catch (err) {
    console.error("POST /api/slots error:", err)
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    )
  }
}