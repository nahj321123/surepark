/**
 * GET   /api/slots/:id   — get a single slot (ESP32 can poll just its own slot)
 * PATCH /api/slots/:id   — update any field on a slot (used by dashboard actions)
 */
import { NextRequest, NextResponse } from "next/server"
import { slotStore } from "@/lib/store"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const slot = slotStore.getById(Number(id))
  if (!slot) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  return NextResponse.json(slot, { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const updated = slotStore.update(Number(id), body as any)
  if (!updated) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true, slot: updated })
}
