"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { VideoIntro } from "@/components/video-intro"
import { AnimatedBackground } from "@/components/animated-background"
import { Header } from "@/components/header"
import { CameraCard } from "@/components/camera-card"
import { StatsCard } from "@/components/stats-card"
import { ChatTerminal } from "@/components/chat-terminal"
import { RobotPeek } from "@/components/robot-peek"

const API_BASE = "http://localhost:8000"

type MoodState = "neutral" | "happy" | "angry" | "sad" | "fear" | "surprise" | "disgust"

interface AppData {
  identity: string
  mood: MoodState
  score: number
  message: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export default function Home() {
  const [showIntro, setShowIntro] = useState(true)
  const [appReady, setAppReady] = useState(false)

  const [data, setData] = useState<AppData>({
    identity: "STANDBY",
    mood: "neutral",
    score: 0,
    message: "AstroBurrus System Initializing...",
  })
  const [loading, setLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [token] = useState(() => Math.random().toString(36).slice(2, 9))
  const [showRobot, setShowRobot] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false)
    setTimeout(() => setAppReady(true), 100)
  }, [])

  // Start webcam on mount
  useEffect(() => {
    if (!showIntro && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) videoRef.current.srcObject = stream
        })
        .catch((err) => console.error("Camera access denied:", err))
    }
  }, [showIntro])

  // Show robot when assistant messages exist
  useEffect(() => {
    const hasAssistant = chatHistory.some((m) => m.role === "assistant")
    setShowRobot(hasAssistant)
  }, [chatHistory])

  // Biometric Scan
  const scanVian = async () => {
    if (!canvasRef.current || !videoRef.current) return
    setLoading(true)
    try {
      const context = canvasRef.current.getContext("2d")
      if (context) {
        context.drawImage(videoRef.current, 0, 0, 400, 300)
      }
      const imageData = canvasRef.current.toDataURL("image/jpeg")

      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      })
      const result = await res.json()

      setData({
        identity: result.identity || "Unknown",
        mood: result.mood || "neutral",
        score: result.score ?? 0,
        message: result.message || "Analysis complete.",
      })

      if (result.score >= 12) {
        setChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `ALERT: Elevated ${(result.mood || "").toUpperCase()} detected. ${result.identity}, please report your current status.`,
          },
        ])
      }
    } catch {
      setData((prev) => ({ ...prev, message: "CONNECTION ERROR" }))
    }
    setLoading(false)
  }

  // Send Chat
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: ChatMessage = { role: "user", content: input }
    setChatHistory((prev) => [...prev, userMessage])
    setInput("")

    try {
      const identityParam =
        data.identity !== "STANDBY" && data.identity !== "Unknown Personnel"
          ? data.identity
          : "Unknown"

      const res = await fetch(
        `${API_BASE}/chat?identity=${encodeURIComponent(identityParam)}&token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...chatHistory, userMessage] }),
        }
      )

      const chatData = await res.json()

      if (chatData.message) {
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: chatData.message },
        ])
      }
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: "Uplink failure. System offline." },
      ])
    }
  }

  const isCritical = data.score >= 12

  return (
    <>
      {/* Video Intro */}
      {showIntro && <VideoIntro onComplete={handleIntroComplete} />}

      {/* Main App */}
      <div
        className={`min-h-screen transition-opacity duration-1000 ${
          appReady ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Animated space background - mood reactive */}
        <AnimatedBackground mood={data.mood} score={data.score} />

        {/* Main content */}
        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-8">
          <Header isCritical={isCritical} message={data.message} />

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
            {/* Camera */}
            <CameraCard
              videoRef={videoRef}
              canvasRef={canvasRef}
              isCritical={isCritical}
            />

            {/* Stats */}
            <StatsCard
              identity={data.identity}
              mood={data.mood}
              score={data.score}
              loading={loading}
              isCritical={isCritical}
              onScan={scanVian}
            />
          </div>

          {/* Chat Terminal with Robot Peek */}
          <div className="relative mt-6">
            <RobotPeek isVisible={showRobot} />
            <ChatTerminal
              chatHistory={chatHistory}
              input={input}
              onInputChange={setInput}
              onSend={sendMessage}
              identity={data.identity}
              isCritical={isCritical}
            />
          </div>
        </main>
      </div>
    </>
  )
}
