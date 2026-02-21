"use client"

import { useRef, useEffect } from "react"
import { ShieldAlert, Send } from "lucide-react"
import Image from "next/image"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ChatTerminalProps {
  chatHistory: ChatMessage[]
  input: string
  onInputChange: (value: string) => void
  onSend: (e: React.FormEvent) => void
  identity: string
  isCritical: boolean
}

export function ChatTerminal({
  chatHistory,
  input,
  onInputChange,
  onSend,
  identity,
  isCritical,
}: ChatTerminalProps) {
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory])

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-700"
      style={{
        backgroundColor: "rgba(13, 18, 37, 0.85)",
        border: `1px solid ${isCritical ? "rgba(232, 64, 64, 0.3)" : "rgba(56, 182, 232, 0.15)"}`,
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Terminal header */}
      <div
        className="flex items-center gap-2 px-4 py-3 font-mono text-xs tracking-widest"
        style={{
          color: isCritical ? "#e84040" : "#38b6e8",
          borderBottom: `1px solid ${isCritical ? "rgba(232, 64, 64, 0.2)" : "rgba(56, 182, 232, 0.1)"}`,
          backgroundColor: "rgba(8, 12, 24, 0.5)",
        }}
      >
        <ShieldAlert size={14} />
        <span>PSYCH-LINK TERMINAL</span>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: isCritical ? "#e84040" : "#38b6e8" }}
          />
          <span style={{ color: "#6882a8" }}>LIVE</span>
        </div>
      </div>

      {/* Chat messages */}
      <div
        className="overflow-y-auto px-4 py-4 flex flex-col gap-3"
        style={{ maxHeight: "380px", minHeight: "280px" }}
      >
        {chatHistory.length === 0 && (
          <div
            className="text-center py-12 font-mono text-sm"
            style={{ color: "#6882a8" }}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "#38b6e8" }}
              />
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "#38b6e8", animationDelay: "0.2s" }}
              />
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "#38b6e8", animationDelay: "0.4s" }}
              />
            </div>
            Waiting for biometric data stream...
          </div>
        )}

        {chatHistory.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="relative mr-2 flex-shrink-0 self-end">
                <div className="w-8 h-8 rounded-full overflow-hidden border"
                  style={{ borderColor: isCritical ? "#e84040" : "#38b6e8" }}
                >
                  <Image
                    src="/images/robot-peek.jpg"
                    alt="ARES_AI"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
            <div
              className="max-w-[75%] rounded-xl px-4 py-3 transition-all duration-500"
              style={
                m.role === "user"
                  ? {
                      backgroundColor: "rgba(56, 182, 232, 0.12)",
                      border: "1px solid rgba(56, 182, 232, 0.2)",
                      color: "#e8edf5",
                    }
                  : {
                      backgroundColor: isCritical
                        ? "rgba(232, 64, 64, 0.08)"
                        : "rgba(30, 144, 200, 0.08)",
                      border: `1px solid ${isCritical ? "rgba(232, 64, 64, 0.2)" : "rgba(30, 144, 200, 0.15)"}`,
                      color: "#e8edf5",
                    }
              }
            >
              <span
                className="block text-[10px] font-mono tracking-wider mb-1"
                style={{
                  color: m.role === "user"
                    ? "#38b6e8"
                    : isCritical
                      ? "#e84040"
                      : "#1e90c8",
                }}
              >
                {m.role === "user"
                  ? identity !== "STANDBY"
                    ? identity
                    : "CREW"
                  : "ARES_AI"}
              </span>
              <p className="text-sm leading-relaxed">{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={onSend}
        className="flex items-center gap-3 px-4 py-3"
        style={{
          borderTop: `1px solid ${isCritical ? "rgba(232, 64, 64, 0.15)" : "rgba(56, 182, 232, 0.1)"}`,
          backgroundColor: "rgba(8, 12, 24, 0.4)",
        }}
      >
        <input
          className="flex-1 bg-transparent px-3 py-2 text-sm font-mono rounded-lg focus:outline-none focus:ring-1 transition-all"
          style={{
            color: "#e8edf5",
            border: `1px solid ${isCritical ? "rgba(232, 64, 64, 0.2)" : "rgba(56, 182, 232, 0.15)"}`,
            backgroundColor: "rgba(13, 18, 37, 0.5)",
          }}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Input mission status report..."
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="p-2.5 rounded-lg font-mono text-xs tracking-wider transition-all duration-300 disabled:opacity-30 hover:scale-105"
          style={{
            backgroundColor: isCritical
              ? "rgba(232, 64, 64, 0.15)"
              : "rgba(56, 182, 232, 0.15)",
            color: isCritical ? "#e84040" : "#38b6e8",
            border: `1px solid ${isCritical ? "rgba(232, 64, 64, 0.3)" : "rgba(56, 182, 232, 0.3)"}`,
          }}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
