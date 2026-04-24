import * as React from "react"

import { cn } from "@/lib/utils"

export function GlassCard({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass-panel rounded-lg", className)} {...props}>
      {children}
    </div>
  )
}
