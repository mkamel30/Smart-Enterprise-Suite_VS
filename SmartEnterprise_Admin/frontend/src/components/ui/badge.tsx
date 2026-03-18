import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[#0A2472] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#0A2472]/10 text-[#0A2472] border border-[#0A2472]/20 hover:bg-[#0A2472]/20",
        secondary:
          "bg-[#6CE4F0]/10 text-[#0A2472] border border-[#6CE4F0]/20 hover:bg-[#6CE4F0]/20",
        destructive:
          "bg-red-100 text-red-700 border border-red-200 hover:bg-red-200",
        outline: "text-[#0A2472] border border-[#0A2472]/20 hover:bg-[#0A2472]/5",
        success:
          "bg-[#80C646]/10 text-[#80C646] border border-[#80C646]/20 hover:bg-[#80C646]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> {
  variant?: "default" | "secondary" | "destructive" | "outline" | null
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
