"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Car, LogOut, MapPin, Clock, CreditCard,
  QrCode, CheckCircle2, XCircle, RefreshCw,
  AlertCircle, ChevronDown, ChevronUp, Info,
  Search, CalendarCheck, Wallet,
  ArrowUp, ArrowDown, ShieldCheck, Zap, Radio
} from "lucide-react"

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

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [slots, setSlots] = useState<ParkingSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null)

  useEffect(() => {
    const u = localStorage.getItem("surepark_user")
    if (!u) return router.push("/login")
    setUser(JSON.parse(u))

    fetch("/api/slots")
      .then(r => r.json())
      .then(setSlots)
  }, [])

  // 🔁 Poll ESP32 updates
  useEffect(() => {
    const i = setInterval(async () => {
      const res = await fetch("/api/slots", { cache: "no-store" })
      const data = await res.json()
      setSlots(data)
    }, 3000)
    return () => clearInterval(i)
  }, [])

  const handleReserve = async (slot: ParkingSlot) => {
    await fetch("/api/slots", {
      method: "POST",
      body: JSON.stringify({ slotId: slot.id, userId: user.email }),
    })
  }

  const handlePayment = async (slot: ParkingSlot) => {
    const qr = `SP-${slot.id}-${Date.now().toString(36).toUpperCase()}`
    await fetch(`/api/slots/${slot.id}`, {
      method: "PATCH",
      body: JSON.stringify({ paid: true, activeQrToken: qr }),
    })
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
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
        {Object.values(slots).map((slot: any) => (
          <div key={slot.id} className="bg-slate-800 p-4 rounded-lg">
            <h2 className="text-xl">{slot.name || `Slot ${slot.id}`}</h2>
            <p className="text-sm text-slate-400">{slot.location}</p>

            {/* STATUS */}
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

            {/* RESERVE */}
            {slot.status === "available" && (
              <button
                onClick={() => handleReserve(slot)}
                className="mt-3 w-full bg-blue-600 py-2 rounded"
              >
                Reserve
              </button>
            )}

            {/* PAYMENT */}
            {slot.status === "reserved" && slot.reservedBy === user.email && !slot.paid && (
              <button
                onClick={() => handlePayment(slot)}
                className="mt-3 w-full bg-green-600 py-2 rounded"
              >
                Pay
              </button>
            )}

            {/* AFTER PAYMENT */}
            {slot.paid && (
              <div className="mt-3 space-y-3">

                <p className="text-xs text-green-400">Payment Complete</p>

                {/* 🔥 SENSOR STATUS (NEW CLEAN VERSION) */}
                <div className="bg-blue-950/50 border border-blue-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
                    <span className="text-sm font-semibold">Sensor</span>

                    <span
                      className={`ml-auto text-xs px-2 py-1 rounded ${
                        slot.status === "occupied"
                          ? "bg-red-700 text-white"
                          : slot.status === "reserved"
                          ? "bg-yellow-700 text-white"
                          : "bg-green-700 text-white"
                      }`}
                    >
                      {slot.status === "occupied"
                        ? "Car Detected"
                        : slot.status === "reserved"
                        ? "Waiting for vehicle..."
                        : "No vehicle"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2">
                    Controlled automatically by ESP32 sensor.
                  </p>
                </div>

                {/* BOLLARD */}
                <button
                  onClick={() => handleBollardToggle(slot)}
                  className="w-full bg-yellow-600 py-2 rounded"
                >
                  {slot.bollardUp ? "Lower Bollard" : "Raise Bollard"}
                </button>
              </div>
            )}

            {/* OCCUPIED */}
            {slot.status === "occupied" && (
              <div className="mt-3 text-red-400 text-sm">
                Car detected (ESP32)
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}