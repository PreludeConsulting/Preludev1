import { cn } from "../lib/utils.js";

/**
 * Circular mentor avatar that prefers a photo, falling back to initials.
 * Used by marketing demos and match cards so Asim is never just "A"/"AY".
 */
export default function MentorPhotoAvatar({
  photo,
  initials,
  name,
  objectPosition = "50% 18%",
  className = "",
  imgClassName = "",
  size
}) {
  const label = initials || (name ? String(name).trim().charAt(0).toUpperCase() : "?");

  if (photo) {
    return (
      <span className={cn("mentor-photo-avatar", size && `mentor-photo-avatar--${size}`, className)} aria-hidden="true">
        <img
          src={photo}
          alt=""
          className={cn("mentor-photo-avatar__img", imgClassName)}
          style={{ objectPosition }}
          width={88}
          height={88}
          decoding="async"
          loading="lazy"
          draggable={false}
        />
      </span>
    );
  }

  return (
    <span className={cn("mentor-photo-avatar mentor-photo-avatar--fallback", size && `mentor-photo-avatar--${size}`, className)} aria-hidden="true">
      {label}
    </span>
  );
}
