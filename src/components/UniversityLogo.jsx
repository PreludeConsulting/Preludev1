import { useState } from "react";

export default function UniversityLogo({ school, className = "" }) {
  const [src, setSrc] = useState(school.logo);

  return (
    <img
      src={src}
      alt={school.alt}
      className={className || "university-logo__img"}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        if (school.logoFallback && src !== school.logoFallback) {
          setSrc(school.logoFallback);
        }
      }}
    />
  );
}
