function userInitial(name) {
  const part = (name || "P").trim().split(/\s+/)[0];
  return (part[0] || "P").toUpperCase();
}

const SIZE_CLASS = {
  sm: "user-avatar--sm",
  md: "user-avatar--md",
  lg: "user-avatar--lg"
};

/** Default avatar with optional uploaded profile image. */
export default function UserAvatar({ name, avatarUrl, size = "md", className = "" }) {
  const initial = userInitial(name);
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`user-avatar user-avatar--photo ${SIZE_CLASS[size] || SIZE_CLASS.md} ${className}`}
      />
    );
  }
  return (
    <span className={`user-avatar ${SIZE_CLASS[size] || SIZE_CLASS.md} ${className}`} aria-hidden="true">
      {initial}
    </span>
  );
}

export function Avatar({ name, avatarUrl, size = "md" }) {
  return <UserAvatar name={name} avatarUrl={avatarUrl} size={size} className="dash-avatar" />;
}
