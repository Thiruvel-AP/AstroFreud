"use client"

import { useRef, useEffect } from "react"
import { Camera, Circle } from "lucide-react"

interface CameraCardProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  isCritical: boolean
}

export function CameraCard({ videoRef, canvasRef, isCritical }: CameraCardProps) {
  const scanLineRef = useRef<HTMLDivElement>(null)

  const accent = isCritical ? "#e84040" : "#38b6e8"
  const panelClass = isCritical ? "hud-panel-critical" : "hud-panel"
  const gridClass = isCritical ? "hud-grid-red" : "hud-grid"

  useEffect(() => {
    let frame = 0
    let animId: number
    const animateScan = () => {
      frame = (frame + 1) % 500
      if (scanLineRef.current) {
        scanLineRef.current.style.top = `${(frame / 500) * 100}%`
      }
      animId = requestAnimationFrame(animateScan)
    }
    animId = requestAnimationFrame(animateScan)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div className={`${panelClass} rounded-xl overflow-hidden transition-all duration-700`}>
      {/* Panel header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 font-mono text-[10px] tracking-[0.2em]"
        style={{
          color: accent,
          borderBottom: `1px solid ${accent}15`,
          backgroundColor: "rgba(5, 8, 16, 0.5)",
        }}
      >
        <Camera size={12} />
        <span>CAMERA FEED</span>
        <div className="ml-auto flex items-center gap-2">
          <Circle size={6} fill={accent} style={{ color: accent }} className="animate-pulse" />
          <span style={{ color: "#5a7098" }}>REC</span>
        </div>
      </div>

      {/* Camera viewport */}
      <div className={`relative aspect-[4/3] overflow-hidden ${gridClass}`}>
        {/* Scan line */}
        <div
          ref={scanLineRef}
          className="absolute left-0 right-0 h-px z-20 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}60, ${accent}90, ${accent}60, transparent)`,
            boxShadow: `0 0 30px ${accent}20, 0 0 60px ${accent}10`,
          }}
        />

        {/* Corner targeting brackets */}
        {[
          { top: 12, left: 12, bTop: true, bLeft: true },
          { top: 12, right: 12, bTop: true, bRight: true },
          { bottom: 12, left: 12, bBottom: true, bLeft: true },
          { bottom: 12, right: 12, bBottom: true, bRight: true },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute w-6 h-6 pointer-events-none z-20"
            style={{
              top: pos.top,
              left: pos.left,
              right: pos.right,
              bottom: pos.bottom,
              borderTop: pos.bTop ? `1.5px solid ${accent}80` : "none",
              borderBottom: pos.bBottom ? `1.5px solid ${accent}80` : "none",
              borderLeft: pos.bLeft ? `1.5px solid ${accent}80` : "none",
              borderRight: pos.bRight ? `1.5px solid ${accent}80` : "none",
            }}
          />
        ))}

        {/* Center crosshair */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="relative w-16 h-16">
            <div className="absolute top-0 left-1/2 -translate-x-px w-px h-4" style={{ backgroundColor: `${accent}40` }} />
            <div className="absolute bottom-0 left-1/2 -translate-x-px w-px h-4" style={{ backgroundColor: `${accent}40` }} />
            <div className="absolute left-0 top-1/2 -translate-y-px h-px w-4" style={{ backgroundColor: `${accent}40` }} />
            <div className="absolute right-0 top-1/2 -translate-y-px h-px w-4" style={{ backgroundColor: `${accent}40` }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${accent}60` }} />
            </div>
          </div>
        </div>

        {/* HUD data overlay */}
        <div className="absolute top-3 right-3 z-20 pointer-events-none text-right">
          <p className="text-[8px] font-mono tracking-wider" style={{ color: `${accent}80` }}>
            FPS: 30 | RES: 640x480
          </p>
          <p className="text-[8px] font-mono tracking-wider" style={{ color: `${accent}60` }}>
            LAT: -33.8688 | LON: 151.2093
          </p>
        </div>

        <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
          <p className="text-[8px] font-mono tracking-wider" style={{ color: `${accent}60` }}>
           SCAN ACTIVE
          </p>
        </div>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" width={400} height={300} />

        {/* Overlay tint */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: `linear-gradient(180deg, ${accent}05 0%, transparent 30%, transparent 70%, ${accent}08 100%)`,
          }}
        />
      </div>
    </div>
  )
}
