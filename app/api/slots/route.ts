import { NextRequest, NextResponse } from "next/server"
import { slotStore } from "@/lib/store"

// 🔒 SAFE RESERVE FUNCTION
function safeReserve(slotId: number, userId: string) {
  const slot = slotStore.getById(slotId)
  if (!slot) return { ok: false, error: "Slot not found" }

  if (slot.status !== "available") {
    return { ok: false, error: "Slot already taken" }
  }

  const updated = slotStore.update(slotId, {
    status: "reserved",
    reservedBy: userId,
    reservedAt: Date.now(),
  })

  return { ok: true, slot: updated }
}

// ✅ REQUIRED EXPORT (GET)
export async function GET() {
  return NextResponse.json(slotStore.getAll(), {
    headers: { "Cache-Control": "no-store" },
  })
}

// ✅ REQUIRED EXPORT (POST)
export async function POST(req: NextRequest) {
  const { slotId, userId } = await req.json()

  if (!slotId || !userId) {
    return NextResponse.json(
      { ok: false, error: "slotId and userId required" },
      { status: 400 }
    )
  }

  const result = safeReserve(slotId, userId)

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result)
}