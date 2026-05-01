/**
 * POST /api/sensor
 * ----------------
 * Called by the ESP32 ultrasonic / IR sensor whenever car presence changes.
 *
 * Request body (JSON):
 * {
 *   "slotId":   1,          // which slot the sensor belongs to (1–5)
 *   "carPresent": true      // true = car detected, false = car left
 * }
 *
 * Behaviour:
 *   carPresent = true  → if slot is "reserved" + paid, set status = "occupied"
 *   carPresent = false → if slot is "occupied", reset to "available"
 *
 * Response: { ok, slot }
 *
 * ESP32 example (Arduino):
 *   HTTPClient http;
 *   http.begin("http://<YOUR_SERVER_IP>:3000/api/sensor");
 *   http.addHeader("Content-Type", "application/json");
 *   int code = http.POST("{\"slotId\":1,\"carPresent\":true}");
 */
import { NextRequest, NextResponse } from "next/server"
import { slotStore } from "@/lib/store"

export async function POST(req: NextRequest) {
  let body: { slotId?: number; carPresent?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { slotId, carPresent } = body

  if (typeof slotId !== "number" || typeof carPresent !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "Required: slotId (number) and carPresent (boolean)" },
      { status: 400 },
    )
  }

  const slot = slotStore.getById(slotId)
  if (!slot) {
    return NextResponse.json({ ok: false, error: `Slot ${slotId} not found` }, { status: 404 })
  }

  let updated = slot

  if (carPresent) {
    // Car arrived — only transition reserved+paid → occupied
    if (slot.status === "reserved" && slot.paid) {
      updated = slotStore.update(slotId, {
        status:    "occupied",
        checkedIn: true,
        bollardUp: true,
      })!
    }
  } else {
    // Car left — reset occupied slot back to available
    if (slot.status === "occupied") {
      updated = slotStore.update(slotId, {
        status:         "available",
        reservedBy:     undefined,
        reservedAt:     undefined,
        paid:           false,
        activeQrToken:  undefined,
        checkedIn:      false,
        bollardUp:      false,
      })!
    }
  }

  return NextResponse.json({ ok: true, slot: updated })
}
