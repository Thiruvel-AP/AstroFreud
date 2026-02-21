"use client"

import { AlertTriangle } from "lucide-react"
import Image from "next/image"

interface HeaderProps {
  isCritical: boolean
  message: string
}

export function Header({ isCritical, message }: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-4 px-1">
      <div className="flex items-center gap-4">
        <Image
          src="/images/logo.png"
          alt="AstroBurrus Logo"
          width={44}
          height={44}
          className="rounded-lg"
        />
        <div>
          <h1
            className="text-xl font-bold tracking-wide"
            style={{ color: "#e8edf5" }}
          >
            AstroBurrus
          </h1>
          <span
            className="text-[10px] font-mono tracking-[0.25em]"
            style={{ color: "#6882a8" }}
          >
            v0 // COMMAND_HUB
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Status message */}
        <p
          className="hidden md:block text-xs font-mono truncate max-w-xs"
          style={{ color: "#6882a8" }}
        >
          {message}
        </p>
        {isCritical && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg animate-pulse"
            style={{
              backgroundColor: "rgba(232, 64, 64, 0.12)",
              border: "1px solid rgba(232, 64, 64, 0.3)",
            }}
          >
            <AlertTriangle size={14} style={{ color: "#e84040" }} />
            <span
              className="text-[10px] font-mono tracking-wider"
              style={{ color: "#e84040" }}
            >
              EVALUATION REQUIRED
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
