"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Car, LogOut, MapPin, Clock, CreditCard,
  QrCode, CheckCircle2, XCircle, RefreshCw,
  AlertCircle, ChevronDown, ChevronUp, Info,
  Search, CalendarCheck, Wallet,
  ArrowUp, ArrowDown, ShieldCheck, Zap,
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

const LOCATIONS = ["Session Road", "Harrison Road", "SM Baguio", "Cedar Peak", "Mabini"]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [slots, setSlots] = useState<ParkingSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null)

  // Load user + slots
  useEffect(() => {
    const u = localStorage.getItem("surepark_user")
    if (!u) return router.push("/login")
    setUser(JSON.parse(u))

    fetch("/api/slots")
      .then(r => r.json())
      .then(setSlots)
  }, [])

  // Poll backend (ESP32 updates reflected here)
  useEffect(() => {
    const i = setInterval(async () => {
      const res = await fetch("/api/slots", { cache: "no-store" })
      const data = await res.json()
      setSlots(data)
    }, 3000)
    return () => clearInterval(i)
  }, [])

  const handleReserve = async (slot: ParkingSlot) => {
    const res = await fetch("/api/slots", {
      method: "POST",
      body: JSON.stringify({ slotId: slot.id, userId: user.email }),
    })
    if (res.ok) {
      const updated = await fetch("/api/slots").then(r => r.json())
      setSlots(updated)
    }
  }

  const handlePayment = async (slot: ParkingSlot) => {
    const qr = `SP-${slot.id}-${Date.now().toString(36).toUpperCase()}`
    await fetch(`/api/slots/${slot.id}`, {
      method: "PATCH",
      body: JSON.stringify({ paid: true, activeQrToken: qr }),
    })
    const updated = await fetch("/api/slots").then(r => r.json())
    setSlots(updated)
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

  const getTimeRemaining = (t?: number) => {
    if (!t) return ""
    const r = 15 * 60 * 1000 - (Date.now() - t)
    if (r <= 0) return "Expired"
    const m = Math.floor(r / 60000)
    const s = Math.floor((r % 60000) / 1000)
    return `${m}:${s.toString().padStart(2, "0")}`
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

            <div className="mt-2">
              <span className="text-xs px-2 py-1 rounded bg-slate-700">
                {slot.status}
              </span>
            </div>

            {slot.status === "available" && (
              <button
                onClick={() => handleReserve(slot)}
                className="mt-3 w-full bg-blue-600 py-2 rounded"
              >
                Reserve
              </button>
            )}

            {slot.status === "reserved" && slot.reservedBy === user.email && !slot.paid && (
              <button
                onClick={() => handlePayment(slot)}
                className="mt-3 w-full bg-green-600 py-2 rounded"
              >
                Pay
              </button>
            )}

            {slot.paid && (
              <div className="mt-3">
                <p className="text-xs text-green-400">Payment Complete</p>

                {/* ESP32 SENSOR STATUS */}
                <div className="mt-2 text-xs text-blue-400">
                  Waiting for ESP32 sensor...
                </div>

                {/* Bollard */}
                <button
                  onClick={() => handleBollardToggle(slot)}
                  className="mt-3 w-full bg-yellow-600 py-2 rounded"
                >
                  {slot.bollardUp ? "Lower Bollard" : "Raise Bollard"}
                </button>
              </div>
            )}

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