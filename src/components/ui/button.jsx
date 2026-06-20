import { motion } from "motion/react";
import { cn } from "../../lib/utils.js";

const variants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/95",
  secondary:
    "border border-primary bg-primary text-primary-foreground hover:border-primary/90 hover:bg-primary/90",
  ghost: "text-foreground/80 hover:text-foreground"
};

export function Button({ as: Component = "a", variant = "primary", className, children, ...props }) {
  const MotionComponent = motion.create(Component);
  const isDisabled = Boolean(props.disabled || props["aria-disabled"] === true);

  return (
    <MotionComponent
      whileHover={isDisabled ? undefined : { y: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-[var(--radius-control)] px-[var(--control-padding-inline)] py-2.5 font-body text-sm font-semibold leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </MotionComponent>
  );
}
