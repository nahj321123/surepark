"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Radio } from "lucide-react"

interface ParkingSlot {
  id: number
  name: string
  location: string
  price: number
  status: "available" | "reserved" | "occupied"
  reservedBy?: string
  reservedAt?: number
  paid?: boolean
  activeQrToken?: string
  bollardUp?: boolean
}

const DEFAULT_SLOTS: ParkingSlot[] = [
  { id: 1, name: "Slot 1", location: "Session Road", price: 50, status: "available" },
  { id: 2, name: "Slot 2", location: "Harrison Road", price: 45, status: "available" },
  { id: 3, name: "Slot 3", location: "SM Baguio", price: 60, status: "available" },
  { id: 4, name: "Slot 4", location: "Cedar Peak", price: 40, status: "available" },
  { id: 5, name: "Slot 5", location: "Mabini", price: 55, status: "available" },
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [slots, setSlots] = useState<ParkingSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null)

  // 🔥 MERGE FUNCTION
  const mergeSlots = (apiSlots: any[]) => {
    return DEFAULT_SLOTS.map((def) => {
      const api = apiSlots.find((s) => s.id === def.id)
      return { ...def, ...api }
    })
  }

  // LOAD
  useEffect(() => {
    const u = localStorage.getItem("surepark_user")
    if (!u) return router.push("/login")
    setUser(JSON.parse(u))

    fetch("/api/slots")
      .then((r) => r.json())
      .then((api) => setSlots(mergeSlots(api || [])))
  }, [])

  // POLLING
  useEffect(() => {
    const i = setInterval(async () => {
      const res = await fetch("/api/slots", { cache: "no-store" })
      const api = await res.json()
      setSlots(mergeSlots(api || []))
    }, 2000)

    return () => clearInterval(i)
  }, [])

  // ACTIONS
  const reserveSlot = async (slot: ParkingSlot) => {
    await fetch("/api/slots", {
      method: "POST",
      body: JSON.stringify({
        slotId: slot.id,
        userId: user.email,
      }),
    })
  }

  const paySlot = async (slot: ParkingSlot) => {
    const qr = `SP-${slot.id}-${Date.now()}`
    await fetch(`/api/slots/${slot.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        paid: true,
        activeQrToken: qr,
      }),
    })
  }

  const toggleBollard = async (slot: ParkingSlot) => {
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
        {slots.map((slot) => (
          <div key={slot.id} className="bg-slate-800 p-4 rounded-lg">
            <h2 className="text-xl font-bold">{slot.name}</h2>
            <p className="text-sm text-gray-400">{slot.location}</p>

            <span className={`text-xs px-2 py-1 rounded ${
              slot.status === "available"
                ? "bg-green-600"
                : slot.status === "reserved"
                ? "bg-yellow-600"
                : "bg-red-600"
            }`}>
              {slot.status.toUpperCase()}
            </span>

            <p className="mt-2">₱{slot.price}/hour</p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setSelectedSlot(slot)}
                className="w-1/2 bg-gray-600 py-2 rounded"
              >
                View
              </button>

              {slot.status === "available" && (
                <button
                  onClick={() => reserveSlot(slot)}
                  className="w-1/2 bg-blue-600 py-2 rounded"
                >
                  Reserve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-slate-800 p-6 rounded-lg w-[350px]">

            <h2 className="text-xl font-bold mb-2">{selectedSlot.name}</h2>
            <p className="text-gray-400">{selectedSlot.location}</p>

            <p className="mt-3">₱{selectedSlot.price}/hour</p>

            {/* PAYMENT */}
            {selectedSlot.status === "reserved" && !selectedSlot.paid && (
              <button
                onClick={() => paySlot(selectedSlot)}
                className="mt-3 w-full bg-green-600 py-2 rounded"
              >
                Pay
              </button>
            )}

            {/* AFTER PAYMENT */}
            {selectedSlot.paid && (
              <>
                <div className="mt-3 bg-green-900/40 p-3 rounded">
                  Payment Complete
                  <div className="text-xs mt-1">
                    QR: {selectedSlot.activeQrToken}
                  </div>
                </div>

                {/* SENSOR STATUS */}
                <div className="mt-3 bg-blue-900/30 p-3 rounded">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>
                      {selectedSlot.status === "occupied"
                        ? "Car Detected"
                        : "Waiting for vehicle"}
                    </span>
                  </div>
                </div>

                {/* BOLLARD */}
                <button
                  onClick={() => toggleBollard(selectedSlot)}
                  className="mt-3 w-full bg-yellow-600 py-2 rounded"
                >
                  {selectedSlot.bollardUp ? "Lower Bollard" : "Raise Bollard"}
                </button>
              </>
            )}

            <button
              onClick={() => setSelectedSlot(null)}
              className="mt-4 w-full bg-red-600 py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}