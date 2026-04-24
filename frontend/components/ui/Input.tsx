import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "h-11 w-full rounded-md border border-[var(--glass-stroke)] bg-[rgba(5,11,20,0.58)] px-3 text-sm text-[var(--text-hi)] outline-none transition placeholder:text-[var(--text-lo)] focus:border-[var(--acea-cyan)] focus:ring-2 focus:ring-[rgba(34,207,255,0.18)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
