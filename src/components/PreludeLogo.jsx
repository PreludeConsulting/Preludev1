const logoSrc = `${import.meta.env.BASE_URL}media/prelude-logo.png`;

export default function PreludeLogo({ className = "" }) {
  return (
    <img
      src={logoSrc}
      alt="Prelude"
      className={`prelude-logo ${className}`.trim()}
      width={160}
      height={40}
      decoding="async"
      draggable={false}
    />
  );
}
