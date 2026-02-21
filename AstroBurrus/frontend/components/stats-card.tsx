"use client"

import { User, AlertTriangle, Activity } from "lucide-react"

interface StatsCardProps {
  identity: string
  mood: string
  score: number
  loading: boolean
  isCritical: boolean
  onScan: () => void
}

export function StatsCard({
  identity,
  mood,
  score,
  loading,
  isCritical,
  onScan,
}: StatsCardProps) {
  const accentColor = isCritical ? "#e84040" : "#38b6e8"
  const accentBg = isCritical
    ? "rgba(232, 64, 64, 0.12)"
    : "rgba(56, 182, 232, 0.12)"
  const accentBorder = isCritical
    ? "rgba(232, 64, 64, 0.3)"
    : "rgba(56, 182, 232, 0.2)"

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-700"
      style={{
        backgroundColor: "rgba(13, 18, 37, 0.85)",
        border: `1px solid ${accentBorder}`,
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 font-mono text-xs tracking-widest"
        style={{
          color: accentColor,
          borderBottom: `1px solid ${isCritical ? "rgba(232, 64, 64, 0.2)" : "rgba(56, 182, 232, 0.1)"}`,
          backgroundColor: "rgba(8, 12, 24, 0.5)",
        }}
      >
        <User size={14} />
        <span>PERSONNEL ID</span>
        {isCritical && (
          <AlertTriangle size={14} className="ml-auto animate-pulse" style={{ color: "#e84040" }} />
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Identity */}
        <div>
          <p className="text-xs font-mono tracking-wider mb-1" style={{ color: "#6882a8" }}>
            IDENTIFIED AS
          </p>
          <h2
            className="text-xl font-bold tracking-wide transition-colors duration-500"
            style={{ color: accentColor }}
          >
            {identity}
          </h2>
        </div>

        {/* Stress gauge */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-mono tracking-wider" style={{ color: "#6882a8" }}>
              STRESS INDEX
            </p>
            <span
              className="text-2xl font-bold font-mono"
              style={{ color: accentColor }}
            >
              {score}
              <span className="text-sm" style={{ color: "#6882a8" }}>/20</span>
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: "rgba(26, 37, 64, 0.8)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(score / 20) * 100}%`,
                backgroundColor: accentColor,
                boxShadow: `0 0 8px ${accentColor}`,
              }}
            />
          </div>
        </div>

        {/* Mood */}
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-lg"
          style={{ backgroundColor: accentBg }}
        >
          <Activity size={16} style={{ color: accentColor }} />
          <div>
            <p className="text-[10px] font-mono tracking-wider" style={{ color: "#6882a8" }}>
              AFFECT
            </p>
            <p className="text-sm font-bold tracking-wider" style={{ color: accentColor }}>
              {mood.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Scan button */}
        <button
          onClick={onScan}
          disabled={loading}
          className="w-full py-3 rounded-lg font-mono text-xs tracking-[0.2em] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          style={{
            backgroundColor: accentBg,
            color: accentColor,
            border: `1px solid ${accentBorder}`,
            boxShadow: `0 0 20px ${isCritical ? "rgba(232, 64, 64, 0.1)" : "rgba(56, 182, 232, 0.1)"}`,
          }}
        >
          {loading ? "CALIBRATING..." : "INITIATE SCAN"}
        </button>
      </div>
    </div>
  )
}
