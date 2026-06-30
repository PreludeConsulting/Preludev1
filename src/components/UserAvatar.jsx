import { useEffect, useState } from "react";
import { getInitials, resolveAvatarUrl } from "../lib/avatar.js";

const SIZE_CLASS = {
  sm: "user-avatar--sm",
  md: "user-avatar--md",
  lg: "user-avatar--lg"
};

/** Default avatar with optional uploaded profile image. */
export default function UserAvatar({ name, user, profile, avatarUrl, oauthAvatarUrl, size = "md", className = "" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const src = resolveAvatarUrl({ profile, user, avatarUrl, oauthAvatarUrl });
  const initial = getInitials(name || profile?.fullName || profile?.full_name || user?.name || user?.email, "P").slice(0, 1);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt=""
        className={`user-avatar user-avatar--photo ${SIZE_CLASS[size] || SIZE_CLASS.md} ${className}`}
        onError={() => setImageFailed(true)}
      />
    );
  }
  return (
    <span className={`user-avatar ${SIZE_CLASS[size] || SIZE_CLASS.md} ${className}`} aria-hidden="true">
      {initial}
    </span>
  );
}

export function Avatar({ name, user, profile, avatarUrl, oauthAvatarUrl, size = "md" }) {
  return <UserAvatar name={name} user={user} profile={profile} avatarUrl={avatarUrl} oauthAvatarUrl={oauthAvatarUrl} size={size} className="dash-avatar" />;
}
