"use client"

import { useState, useRef, useEffect } from "react"

interface VideoIntroProps {
  onComplete: () => void
}

export function VideoIntro({ onComplete }: VideoIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [fadeOut, setFadeOut] = useState(false)
  const [showSkip, setShowSkip] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  const handleVideoEnd = () => {
    setFadeOut(true)
    setTimeout(onComplete, 800)
  }

  const handleSkip = () => {
    if (videoRef.current) {
      videoRef.current.pause()
    }
    setFadeOut(true)
    setTimeout(onComplete, 800)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-700 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "#080c18" }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/intro.mp4" type="video/mp4" />
      </video>

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, #080c18 100%)",
        }}
      />

      {/* Skip button */}
      {showSkip && (
        <button
          onClick={handleSkip}
          className="absolute bottom-8 right-8 px-5 py-2 rounded-lg text-sm font-mono tracking-wider transition-all duration-300 hover:scale-105"
          style={{
            backgroundColor: "rgba(56, 182, 232, 0.15)",
            color: "#38b6e8",
            border: "1px solid rgba(56, 182, 232, 0.3)",
            backdropFilter: "blur(8px)",
          }}
        >
          SKIP INTRO
        </button>
      )}

      {/* Fallback: auto-skip after 15s if video doesn't load */}
      <FallbackTimer onTimeout={handleSkip} />
    </div>
  )
}

function FallbackTimer({ onTimeout }: { onTimeout: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onTimeout, 15000)
    return () => clearTimeout(timer)
  }, [onTimeout])
  return null
}
