"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  tilt?: boolean
}

export function GlassCard({ className, children, tilt = false, ...props }: GlassCardProps) {
  return (
    <motion.div
      layout
      whileHover={tilt ? { rotateX: 1.6, rotateY: -4, y: -2 } : { y: -2 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn("glass-card", className)}
    >
      <div {...props} className="contents">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(75,214,255,0.08),transparent_30%)] opacity-0 transition duration-300 group-hover:opacity-100" />
        {children}
      </div>
    </motion.div>
  )
}
