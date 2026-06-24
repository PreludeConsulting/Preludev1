import { useInterfaceSound } from "../../lib/sound/SoundProvider.jsx";
import { cn } from "../../lib/utils.js";

export default function InteractiveButton({
  as: Tag = "button",
  className,
  children,
  loading = false,
  sound = true,
  pressVariant = "standard",
  onClick,
  ...props
}) {
  const { play, SOUND_EVENTS } = useInterfaceSound();
  const isDisabled = Boolean(props.disabled || loading || props["aria-disabled"]);

  function handleClick(e) {
    if (isDisabled) return;
    if (sound) play(SOUND_EVENTS.CLICK);
    onClick?.(e);
  }

  return (
    <Tag
      className={cn("prelude-btn-motion", className, loading && "prelude-btn-motion--loading")}
      data-press-variant={pressVariant}
      onClick={handleClick}
      disabled={Tag === "button" ? isDisabled : undefined}
      aria-disabled={Tag !== "button" && isDisabled ? true : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="prelude-btn-motion__spinner" aria-hidden="true" /> : null}
      {children}
    </Tag>
  );
}
