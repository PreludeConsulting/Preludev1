export default function UniversityLogo({ school, className = "", loading = "lazy" }) {
  return (
    <img
      src={school.logo}
      alt={school.alt}
      className={className || "university-logo__img"}
      style={school.logoStyle}
      width={school.logoWidth}
      height={school.logoHeight}
      loading={loading}
      decoding="async"
      draggable={false}
    />
  );
}
