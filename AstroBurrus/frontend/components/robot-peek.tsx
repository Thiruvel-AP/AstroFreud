"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

interface RobotPeekProps {
  isVisible: boolean
}

export function RobotPeek({ isVisible }: RobotPeekProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setShow(true), 300)
      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [isVisible])

  return (
    <div
      className="absolute -left-10 bottom-2 transition-transform duration-500 ease-out"
      style={{
        transform: show ? "translateX(0)" : "translateX(-60px)",
      }}
    >
      <div className="relative w-14 h-14">
        <Image
          src="/images/robot-peek.jpg"
          alt="AstroBurrus AI Assistant"
          width={56}
          height={56}
          className="rounded-full border-2"
          style={{ borderColor: "#38b6e8" }}
        />
        {/* Glow effect */}
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            boxShadow: "0 0 12px rgba(56, 182, 232, 0.4)",
          }}
        />
      </div>
    </div>
  )
}
