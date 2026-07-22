const logoSrc = `${import.meta.env.BASE_URL}media/prelude-logo.png`;

export default function PreludeLogo({ className = "" }) {
  return (
    <img
      src={logoSrc}
      alt="Prelude"
      className={`prelude-logo ${className}`.trim()}
      width={1024}
      height={395}
      decoding="async"
      draggable={false}
    />
  );
}
