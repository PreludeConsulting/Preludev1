import { cn } from "../../lib/utils.js";
import { useInterfaceSound } from "../../lib/sound/SoundProvider.jsx";

const variants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/95",
  secondary:
    "border border-primary bg-primary text-primary-foreground hover:border-primary/90 hover:bg-primary/90",
  ghost: "text-foreground/80 hover:text-foreground"
};

export function Button({
  as: Component = "a",
  variant = "primary",
  className,
  children,
  loading = false,
  sound = true,
  pressVariant,
  onClick,
  ...props
}) {
  const { play, SOUND_EVENTS } = useInterfaceSound();
  const isDisabled = Boolean(props.disabled || loading || props["aria-disabled"] === true);
  const resolvedPressVariant = pressVariant || (variant === "primary" ? "primary" : "standard");

  function handleClick(e) {
    if (isDisabled) return;
    if (sound) play(SOUND_EVENTS.CLICK);
    onClick?.(e);
  }

  return (
    <Component
      data-press-variant={resolvedPressVariant}
      data-anime-hover={variant === "primary" ? "primary" : undefined}
      className={cn(
        "prelude-btn-motion inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-[var(--radius-control)] px-[var(--control-padding-inline)] py-2.5 font-body text-sm font-semibold leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        loading && "prelude-btn-motion--loading",
        variants[variant],
        className
      )}
      onClick={handleClick}
      disabled={Component === "button" ? isDisabled : undefined}
      aria-disabled={Component !== "button" && isDisabled ? true : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="prelude-btn-motion__spinner" aria-hidden="true" /> : null}
      {children}
    </Component>
  );
}
