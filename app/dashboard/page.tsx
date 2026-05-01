"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface ParkingSlot {
  id: number
  name: string
  location: string
  price: number
  status: "available" | "reserved" | "occupied"
  reservedBy?: string
  reservedAt?: number
  paid?: boolean
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

  // 🔥 MERGE FUNCTION (KEY FIX)
  const mergeSlots = (apiSlots: any[]) => {
    return DEFAULT_SLOTS.map((def) => {
      const api = apiSlots.find((s) => s.id === def.id)
      return {
        ...def,
        ...api,
      }
    })
  }

  // INITIAL LOAD
  useEffect(() => {
    const u = localStorage.getItem("surepark_user")
    if (!u) return router.push("/login")
    setUser(JSON.parse(u))

    fetch("/api/slots")
      .then(async (r) => {
        if (!r.ok) throw new Error("API error")
        return r.json()
      })
      .then((api) => {
        const merged = mergeSlots(api || [])
        setSlots(merged)
      })
      .catch(() => {
        setSlots(DEFAULT_SLOTS)
      })
  }, [])

  // 🔄 POLLING (ESP32 updates)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/slots", { cache: "no-store" })
        if (!res.ok) return

        const api = await res.json()
        const merged = mergeSlots(api || [])

        setSlots(merged)
      } catch {}
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // ACTIONS
  const handleReserve = async (slot: ParkingSlot) => {
    await fetch("/api/slots", {
      method: "POST",
      body: JSON.stringify({
        slotId: slot.id,
        userId: user.email,
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
        {slots.map((slot) => (
          <div key={slot.id} className="bg-slate-800 p-4 rounded-lg">

            <h2 className="text-xl font-bold">{slot.name}</h2>
            <p className="text-sm text-gray-400">{slot.location}</p>

            {/* STATUS */}
            <div className="mt-2">
              <span className={`text-xs px-2 py-1 rounded ${
                slot.status === "available"
                  ? "bg-green-600"
                  : slot.status === "reserved"
                  ? "bg-yellow-600"
                  : "bg-red-600"
              }`}>
                {slot.status.toUpperCase()}
              </span>
            </div>

            {/* PRICE */}
            <p className="mt-2 text-lg">₱{slot.price}/hour</p>

            {/* ACTION BUTTONS */}
            {slot.status === "available" && (
              <button
                onClick={() => handleReserve(slot)}
                className="mt-3 w-full bg-blue-600 py-2 rounded"
              >
                Reserve
              </button>
            )}

            {slot.status === "reserved" && slot.paid && (
              <button
                onClick={() => handleBollard(slot)}
                className="mt-3 w-full bg-yellow-600 py-2 rounded"
              >
                {slot.bollardUp ? "Lower Bollard" : "Raise Bollard"}
              </button>
            )}

            {slot.status === "occupied" && (
              <div className="mt-3 text-red-400 text-sm">
                Car Detected (ESP32)
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}