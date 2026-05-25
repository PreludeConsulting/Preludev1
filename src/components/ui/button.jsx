import { motion } from "motion/react";
import { cn } from "../../lib/utils.js";

const variants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/95",
  secondary: "border border-foreground/20 bg-transparent text-foreground hover:bg-foreground/[0.04]",
  ghost: "text-foreground/80 hover:text-foreground"
};

export function Button({ as: Component = "a", variant = "primary", className, children, ...props }) {
  const MotionComponent = motion.create(Component);

  return (
    <MotionComponent
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-body text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </MotionComponent>
  );
}
