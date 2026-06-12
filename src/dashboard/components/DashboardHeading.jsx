/** Dashboard page title — uses SF system font via dash-shell. */
export default function DashboardHeading({ children, className = "" }) {
  return <h1 className={`dash-page-title shopify-hero__headline ${className}`.trim()}>{children}</h1>;
}
