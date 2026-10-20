import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.6rem] text-sm font-medium transition-[background-color,box-shadow,color,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Ink on paper: the one primary action in a view.
        default: "bg-primary text-primary-foreground shadow-[0_1px_2px_hsl(var(--blue)/0.35),inset_0_1px_0_hsl(0_0%_100%/0.14)] hover:bg-primary/90",
        // A hairline button for everything else.
        secondary: "border border-hairline bg-card text-foreground shadow-[0_1px_2px_hsl(var(--ink)/0.05)] hover:border-input/60 hover:bg-well",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-hairline bg-transparent text-foreground hover:bg-well",
        ghost: "text-foreground hover:bg-well",
        link: "text-info underline underline-offset-4 decoration-info/40 hover:decoration-info",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[0.8125rem]",
        lg: "h-10 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  iconLeft?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, iconLeft, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {iconLeft && <span className="-ml-0.5 inline-flex [&_svg]:size-4">{iconLeft}</span>}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
