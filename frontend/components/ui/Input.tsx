import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "h-11 w-full rounded-2xl border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.86)] px-4 text-sm text-[var(--text-hi)] outline-none transition placeholder:text-[var(--text-lo)] focus:border-[rgba(75,214,255,0.42)] focus:ring-4 focus:ring-[rgba(75,214,255,0.1)]",
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
