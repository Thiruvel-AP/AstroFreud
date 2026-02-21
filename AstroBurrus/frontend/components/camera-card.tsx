"use client"

import { useRef, useEffect } from "react"
import { Camera } from "lucide-react"

interface CameraCardProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  isCritical: boolean
}

export function CameraCard({ videoRef, canvasRef, isCritical }: CameraCardProps) {
  const scanLineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    let animId: number

    const animateScan = () => {
      frame = (frame + 1) % 400
      if (scanLineRef.current) {
        const percent = (frame / 400) * 100
        scanLineRef.current.style.top = `${percent}%`
      }
      animId = requestAnimationFrame(animateScan)
    }
    animId = requestAnimationFrame(animateScan)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-700"
      style={{
        backgroundColor: "rgba(13, 18, 37, 0.85)",
        border: `1px solid ${isCritical ? "rgba(232, 64, 64, 0.3)" : "rgba(56, 182, 232, 0.15)"}`,
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 font-mono text-xs tracking-widest"
        style={{
          color: isCritical ? "#e84040" : "#38b6e8",
          borderBottom: `1px solid ${isCritical ? "rgba(232, 64, 64, 0.2)" : "rgba(56, 182, 232, 0.1)"}`,
          backgroundColor: "rgba(8, 12, 24, 0.5)",
        }}
      >
        <Camera size={14} />
        <span>LIVE BIOMETRICS</span>
        <div className="ml-auto flex gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#e84040" }} />
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#f0c040" }} />
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#40e870" }} />
        </div>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden">
        {/* Scan line */}
        <div
          ref={scanLineRef}
          className="absolute left-0 right-0 h-0.5 z-10 pointer-events-none"
          style={{
            backgroundColor: isCritical ? "rgba(232, 64, 64, 0.6)" : "rgba(56, 182, 232, 0.5)",
            boxShadow: isCritical
              ? "0 0 20px rgba(232, 64, 64, 0.3)"
              : "0 0 20px rgba(56, 182, 232, 0.3)",
          }}
        />
        {/* Corner brackets */}
        <div className="absolute top-3 left-3 w-5 h-5 pointer-events-none z-10"
          style={{ borderLeft: `2px solid ${isCritical ? "#e84040" : "#38b6e8"}`, borderTop: `2px solid ${isCritical ? "#e84040" : "#38b6e8"}` }}
        />
        <div className="absolute top-3 right-3 w-5 h-5 pointer-events-none z-10"
          style={{ borderRight: `2px solid ${isCritical ? "#e84040" : "#38b6e8"}`, borderTop: `2px solid ${isCritical ? "#e84040" : "#38b6e8"}` }}
        />
        <div className="absolute bottom-3 left-3 w-5 h-5 pointer-events-none z-10"
          style={{ borderLeft: `2px solid ${isCritical ? "#e84040" : "#38b6e8"}`, borderBottom: `2px solid ${isCritical ? "#e84040" : "#38b6e8"}` }}
        />
        <div className="absolute bottom-3 right-3 w-5 h-5 pointer-events-none z-10"
          style={{ borderRight: `2px solid ${isCritical ? "#e84040" : "#38b6e8"}`, borderBottom: `2px solid ${isCritical ? "#e84040" : "#38b6e8"}` }}
        />
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" width={400} height={300} />
        {/* Overlay grid */}
        <div
          className="absolute inset-0 pointer-events-none z-10 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(56,182,232,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(56,182,232,0.1) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>
    </div>
  )
}
