"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const liquidButtonVariants = cva(
  "liquid-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-[var(--text-hi)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(75,214,255,0.32)] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "text-[var(--acea-ice)]",
        ghost:
          "border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.03)] shadow-none hover:border-[rgba(75,214,255,0.24)]",
        subtle: "bg-[rgba(255,255,255,0.03)] text-[var(--text-md)] shadow-none"
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4",
        lg: "h-12 px-5",
        icon: "h-10 w-10 rounded-xl px-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
)

export interface LiquidButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof liquidButtonVariants> {
  asChild?: boolean
}

export const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    if (asChild) {
      const Comp = Slot
      return <Comp className={cn(liquidButtonVariants({ variant, size, className }))} {...props} />
    }

    return (
      <button ref={ref} className={cn(liquidButtonVariants({ variant, size, className }))} {...props} />
    )
  }
)

LiquidButton.displayName = "LiquidButton"
