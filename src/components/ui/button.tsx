import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn",
  {
    variants: {
      variant: {
        gold: "btn-primary",     // legacy alias from the original repo
        primary: "btn-primary",
        secondary: "btn-secondary",
        burgundy: "btn-secondary",
        ghost: "btn-ghost",
        danger: "btn-danger",
      },
      size: {
        default: "",
        sm: "btn-sm",
        lg: "btn-lg",
        xl: "btn-lg text-xl px-12 min-h-[60px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
