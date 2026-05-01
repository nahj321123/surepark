/**
 * POST /api/bollard
 * -----------------
 * Sent by the web dashboard when the user presses Raise / Lower Bollard.
 * The ESP32 polls GET /api/bollard?slotId=1 to know what position to hold.
 *
 * POST body:
 * { "slotId": 1, "bollardUp": true }
 *
 * GET query:
 * /api/bollard?slotId=1  → { slotId, bollardUp }
 *
 * The ESP32 Arduino loop does:
 *   GET /api/bollard?slotId=<N>
 *   parse bollardUp
 *   if bollardUp == true  → activate servo/motor to RAISE position
 *   if bollardUp == false → activate servo/motor to LOWER position
 */
import { NextRequest, NextResponse } from "next/server"
import { slotStore } from "@/lib/store"

// GET — ESP32 polls this to get the latest bollard command
export async function GET(req: NextRequest) {
  const slotId = Number(req.nextUrl.searchParams.get("slotId"))
  if (!slotId) {
    return NextResponse.json({ ok: false, error: "slotId query param required" }, { status: 400 })
  }

  const slot = slotStore.getById(slotId)
  if (!slot) {
    return NextResponse.json({ ok: false, error: `Slot ${slotId} not found` }, { status: 404 })
  }

  return NextResponse.json(
    { ok: true, slotId: slot.id, bollardUp: slot.bollardUp ?? false },
    { headers: { "Cache-Control": "no-store" } },
  )
}

// POST — dashboard sends this when user clicks Raise/Lower button
export async function POST(req: NextRequest) {
  let body: { slotId?: number; bollardUp?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { slotId, bollardUp } = body

  if (typeof slotId !== "number" || typeof bollardUp !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "Required: slotId (number) and bollardUp (boolean)" },
      { status: 400 },
    )
  }

  const slot = slotStore.getById(slotId)
  if (!slot) {
    return NextResponse.json({ ok: false, error: `Slot ${slotId} not found` }, { status: 404 })
  }

  if (!slot.paid) {
    return NextResponse.json(
      { ok: false, error: "Bollard control only available after payment" },
      { status: 403 },
    )
  }

  const updated = slotStore.update(slotId, { bollardUp })
  return NextResponse.json({ ok: true, slot: updated })
}
