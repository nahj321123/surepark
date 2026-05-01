// NEW SAFE UPDATE FUNCTION
function safeReserve(slotId: number, userId: string) {
  const slot = slotStore.getById(slotId)
  if (!slot) return { ok: false, error: "Slot not found" }

  // 🔒 LOCK: prevent overwrite
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