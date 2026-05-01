"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Car, Radio } from "lucide-react"

interface ParkingSlot {
  id: number
  name?: string
  location?: string
  price?: number
  status?: "available" | "reserved" | "occupied"
  reservedBy?: string | null
  paid?: boolean
  bollardUp?: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [slots, setSlots] = useState<Record<string, ParkingSlot>>({})

  // ✅ Load user + initial data
  useEffect(() => {
    const u = localStorage.getItem("surepark_user")
    if (!u) return router.push("/login")

    setUser(JSON.parse(u))

    fetch("/api/slots")
      .then(r => r.json())
      .then(data => setSlots(data || {}))
      .catch(() => setSlots({}))
  }, [])

  // ✅ Poll updates (ESP32 sync)
  useEffect(() => {
    const i = setInterval(async () => {
      try {
        const res = await fetch("/api/slots", { cache: "no-store" })
        const data = await res.json()
        setSlots(data || {})
      } catch {}
    }, 1000)

    return () => clearInterval(i)
  }, [])

  const handleReserve = async (slotId: number) => {
    await fetch("/api/slots", {
      method: "POST",
      body: JSON.stringify({
        slotId,
        userId: user.email,
      }),
    })
  }

  const handlePayment = async (slotId: number) => {
    const qr = `SP-${slotId}-${Date.now()}`
    await fetch(`/api/slots/${slotId}`, {
      method: "PATCH",
      body: JSON.stringify({
        paid: true,
        activeQrToken: qr,
      }),
    })
  }

  const handleBollard = async (slot: ParkingSlot) => {
    await fetch("/api/bollard", {
      method: "POST",
      body: JSON.stringify({
        slotId: slot.id,
        bollardUp: !slot.bollardUp,
      }),
    })
  }

  if (!user) return null

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">SurePark Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.values(slots).map((slot) => (
          <div key={slot.id} className="bg-slate-800 p-4 rounded-lg">

            <h2 className="text-lg font-bold">
              {slot.name || `Slot ${slot.id}`}
            </h2>

            <p className="text-sm text-gray-400">
              {slot.location || "Unknown location"}
            </p>

            {/* STATUS */}
            <div className="mt-2">
              <span className={`text-xs px-2 py-1 rounded ${
                slot.status === "available"
                  ? "bg-green-600"
                  : slot.status === "reserved"
                  ? "bg-yellow-600"
                  : "bg-red-600"
              }`}>
                {(slot.status || "available").toUpperCase()}
              </span>
            </div>

            {/* RESERVE */}
            {slot.status === "available" && (
              <button
                onClick={() => handleReserve(slot.id)}
                className="mt-3 w-full bg-blue-600 py-2 rounded"
              >
                Reserve
              </button>
            )}

            {/* PAYMENT */}
            {slot.status === "reserved" &&
             slot.reservedBy === user.email &&
             !slot.paid && (
              <button
                onClick={() => handlePayment(slot.id)}
                className="mt-3 w-full bg-green-600 py-2 rounded"
              >
                Pay
              </button>
            )}

            {/* AFTER PAYMENT */}
            {slot.paid && (
              <div className="mt-3 space-y-3">

                <p className="text-xs text-green-400">
                  Payment Complete
                </p>

                {/* SENSOR STATUS */}
                <div className="bg-blue-900/30 border border-blue-700 rounded p-3">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 animate-pulse text-blue-400" />

                    <span className="text-sm font-semibold">
                      Sensor
                    </span>

                    <span className={`ml-auto text-xs px-2 py-1 rounded ${
                      slot.status === "occupied"
                        ? "bg-red-600"
                        : slot.status === "reserved"
                        ? "bg-yellow-600"
                        : "bg-green-600"
                    }`}>
                      {slot.status === "occupied"
                        ? "Car Detected"
                        : slot.status === "reserved"
                        ? "Waiting..."
                        : "Empty"}
                    </span>
                  </div>
                </div>

                {/* BOLLARD */}
                <button
                  onClick={() => handleBollard(slot)}
                  className="w-full bg-yellow-600 py-2 rounded"
                >
                  {slot.bollardUp ? "Lower Bollard" : "Raise Bollard"}
                </button>
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  )
}