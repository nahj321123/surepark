"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Car, LogOut, MapPin, Clock } from "lucide-react"

const ParkingMap = dynamic(() => import("@/components/ParkingMap"), { ssr: false })

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
  checkedIn?: boolean
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

  // ✅ MERGE FUNCTION (IMPORTANT)
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
      .catch(() => setSlots(DEFAULT_SLOTS))
  }, [])

  // POLLING (ESP32 updates)
  useEffect(() => {
    const i = setInterval(async () => {
      try {
        const res = await fetch("/api/slots", { cache: "no-store" })
        const api = await res.json()
        setSlots(mergeSlots(api || []))
      } catch {}
    }, 2000)

    return () => clearInterval(i)
  }, [])

  if (!user) return null

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">SurePark Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {slots.map((slot) => (
          <div key={slot.id} className="bg-slate-800 p-4 rounded-lg">
            <h2 className="text-xl">{slot.name}</h2>
            <p className="text-sm text-slate-400">{slot.location}</p>

            <div className="mt-2">
              <span
                className={`text-xs px-2 py-1 rounded ${
                  slot.status === "available"
                    ? "bg-green-700"
                    : slot.status === "reserved"
                    ? "bg-yellow-700"
                    : "bg-red-700"
                }`}
              >
                {slot.status.toUpperCase()}
              </span>
            </div>

            <p className="mt-2">₱{slot.price}/hour</p>
          </div>
        ))}
      </div>
    </div>
  )
}