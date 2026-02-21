"use client"

import { useEffect, useRef, useMemo } from "react"

type MoodState = "neutral" | "happy" | "angry" | "sad" | "fear" | "surprise" | "disgust"

interface AnimatedBackgroundProps {
  mood: MoodState
  score: number
}

interface Star {
  x: number
  y: number
  size: number
  speed: number
  opacity: number
  twinkleSpeed: number
  twinkleOffset: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  life: number
  maxLife: number
  color: string
}

function getMoodColors(mood: MoodState, score: number) {
  const isCritical = score >= 12

  if (isCritical || mood === "angry" || mood === "fear" || mood === "sad" || mood === "disgust") {
    return {
      bg1: "#180808",
      bg2: "#1a0505",
      glow: "rgba(232, 64, 64, 0.08)",
      particleColors: ["#e84040", "#ff6060", "#cc2020", "#ff4444"],
      starColor: "rgba(255, 140, 140, VAR)",
      nebulaColor: "rgba(200, 40, 40, 0.04)",
    }
  }

  if (mood === "happy" || mood === "surprise") {
    return {
      bg1: "#061218",
      bg2: "#081620",
      glow: "rgba(56, 232, 180, 0.06)",
      particleColors: ["#38e8b4", "#4fd8ff", "#38b6e8", "#80ffdd"],
      starColor: "rgba(120, 230, 200, VAR)",
      nebulaColor: "rgba(56, 182, 232, 0.04)",
    }
  }

  // neutral
  return {
    bg1: "#080c18",
    bg2: "#0a1020",
    glow: "rgba(56, 182, 232, 0.04)",
    particleColors: ["#38b6e8", "#1e90c8", "#4fd8ff", "#6882a8"],
    starColor: "rgba(200, 220, 240, VAR)",
    nebulaColor: "rgba(30, 144, 200, 0.03)",
  }
}

export function AnimatedBackground({ mood, score }: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const starsRef = useRef<Star[]>([])
  const particlesRef = useRef<Particle[]>([])
  const currentColorsRef = useRef(getMoodColors("neutral", 0))
  const targetColorsRef = useRef(getMoodColors("neutral", 0))

  const starCount = 120

  // Initialize stars once
  useMemo(() => {
    const stars: Star[] = []
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.0001 + 0.00005,
        opacity: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2,
      })
    }
    starsRef.current = stars
  }, [])

  // Update target colors on mood change
  useEffect(() => {
    targetColorsRef.current = getMoodColors(mood, score)
  }, [mood, score])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    let frame = 0

    const spawnParticle = (colors: string[]) => {
      if (particlesRef.current.length > 30) return
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 60 + 30,
        life: 0,
        maxLife: Math.random() * 300 + 200,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    const animate = () => {
      frame++
      const w = canvas.width
      const h = canvas.height
      const colors = targetColorsRef.current

      // Background gradient
      const gradient = ctx.createRadialGradient(
        w / 2, h / 2, 0,
        w / 2, h / 2, Math.max(w, h) * 0.7
      )
      gradient.addColorStop(0, colors.bg2)
      gradient.addColorStop(1, colors.bg1)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)

      // Nebula glow effects
      for (let i = 0; i < 3; i++) {
        const nx = w * (0.3 + i * 0.2) + Math.sin(frame * 0.001 + i) * 80
        const ny = h * (0.3 + i * 0.15) + Math.cos(frame * 0.0015 + i) * 60
        const nebGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, 200)
        nebGrad.addColorStop(0, colors.nebulaColor)
        nebGrad.addColorStop(1, "transparent")
        ctx.fillStyle = nebGrad
        ctx.fillRect(0, 0, w, h)
      }

      // Draw stars
      starsRef.current.forEach((star) => {
        const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinkleOffset)
        const currentOpacity = star.opacity * (0.5 + twinkle * 0.5)
        const sx = star.x * w
        const sy = ((star.y + frame * star.speed) % 1) * h

        ctx.beginPath()
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2)
        ctx.fillStyle = colors.starColor.replace("VAR", String(currentOpacity))
        ctx.fill()

        // Star glow
        if (star.size > 1.5) {
          const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, star.size * 4)
          glowGrad.addColorStop(0, colors.starColor.replace("VAR", String(currentOpacity * 0.3)))
          glowGrad.addColorStop(1, "transparent")
          ctx.fillStyle = glowGrad
          ctx.fillRect(sx - star.size * 4, sy - star.size * 4, star.size * 8, star.size * 8)
        }
      })

      // Floating particles
      if (frame % 30 === 0) {
        spawnParticle(colors.particleColors)
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++
        p.x += p.vx
        p.y += p.vy
        const lifeRatio = p.life / p.maxLife
        const alpha = lifeRatio < 0.2
          ? lifeRatio * 5
          : lifeRatio > 0.8
            ? (1 - lifeRatio) * 5
            : 1
        const pGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
        pGrad.addColorStop(0, p.color.replace(")", `, ${alpha * 0.06})`).replace("rgb", "rgba"))
        pGrad.addColorStop(1, "transparent")
        ctx.fillStyle = pGrad
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2)
        return p.life < p.maxLife
      })

      // Scan line effect
      const scanY = (frame * 0.5) % h
      ctx.fillStyle = "rgba(56, 182, 232, 0.015)"
      ctx.fillRect(0, scanY, w, 2)

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
