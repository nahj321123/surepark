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
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // 🔥 merge API + static
  const mergeSlots = (api: any[]) =>
    DEFAULT_SLOTS.map((d) => {
      const s = api.find((x) => x.id === d.id)
      return { ...d, ...s }
    })

  const load = async () => {
    try {
      const res = await fetch("/api/slots", { cache: "no-store" })
      const data = await res.json()
      setSlots(mergeSlots(data || []))
    } catch {
      setSlots(DEFAULT_SLOTS)
    }
  }

  useEffect(() => {
    const u = localStorage.getItem("surepark_user")
    if (!u) {
      setUser({ email: "demo@surepark.com" }) // fallback
    } else {
      setUser(JSON.parse(u))
    }
    load()
  }, [])

  useEffect(() => {
    const i = setInterval(load, 2000)
    return () => clearInterval(i)
  }, [])

  const selected = slots.find((s) => s.id === selectedId)

  // ACTIONS
  const reserve = async (s: ParkingSlot) => {
    await fetch("/api/slots", {
      method: "POST",
      body: JSON.stringify({ slotId: s.id, userId: user.email }),
    })
    load()
  }

  const pay = async (s: ParkingSlot) => {
    const qr = `SP-${s.id}-${Date.now()}`
    await fetch(`/api/slots/${s.id}`, {
      method: "PATCH",
      body: JSON.stringify({ paid: true, activeQrToken: qr }),
    })
    load()
  }

  const toggleBollard = async (s: ParkingSlot) => {
    await fetch("/api/bollard", {
      method: "POST",
      body: JSON.stringify({ slotId: s.id, bollardUp: !s.bollardUp }),
    })
    load()
  }

  if (!user) return null

  return (
    <div className="p-8 text-white max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">SurePark Dashboard</h1>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {slots.map((s) => (
          <div key={s.id} className="bg-slate-800 rounded-xl p-5 shadow-lg">

            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">{s.name}</h2>

              <span className={`text-xs px-2 py-1 rounded ${
                s.status === "available"
                  ? "bg-green-600"
                  : s.status === "reserved"
                  ? "bg-yellow-600"
                  : "bg-red-600"
              }`}>
                {s.status}
              </span>
            </div>

            <p className="text-sm text-gray-400">{s.location}</p>

            <p className="mt-3 text-lg font-semibold">₱{s.price}/hour</p>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSelectedId(s.id)}
                className="flex-1 bg-gray-600 py-2 rounded"
              >
                View
              </button>

              <button
                disabled={s.status !== "available"}
                onClick={() => reserve(s)}
                className={`flex-1 py-2 rounded ${
                  s.status === "available"
                    ? "bg-blue-600"
                    : "bg-gray-500 cursor-not-allowed"
                }`}
              >
                Reserve
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 p-6 rounded-xl w-[380px]">

            <h2 className="text-xl font-bold">{selected.name}</h2>
            <p className="text-gray-400">{selected.location}</p>

            <p className="mt-2 text-lg">₱{selected.price}/hour</p>

            {/* PAYMENT */}
            {selected.status === "reserved" && !selected.paid && (
              <button
                onClick={() => pay(selected)}
                className="mt-4 w-full bg-green-600 py-2 rounded"
              >
                Pay
              </button>
            )}

            {/* AFTER PAYMENT */}
            {selected.paid && (
              <>
                <div className="mt-4 bg-green-800/40 p-3 rounded">
                  <p>Payment Complete</p>
                  <p className="text-xs break-all mt-1">
                    {selected.activeQrToken}
                  </p>
                </div>

                <div className="mt-4 bg-blue-900/40 p-3 rounded flex items-center gap-2">
                  <Radio className="w-4 h-4 animate-pulse" />
                  {selected.status === "occupied"
                    ? "Car detected"
                    : "Waiting for vehicle"}
                </div>

                <button
                  onClick={() => toggleBollard(selected)}
                  className="mt-4 w-full bg-yellow-600 py-2 rounded"
                >
                  {selected.bollardUp ? "Lower Bollard" : "Raise Bollard"}
                </button>
              </>
            )}

            <button
              onClick={() => setSelectedId(null)}
              className="mt-5 w-full bg-red-600 py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}