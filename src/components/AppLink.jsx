import { Link, useLocation } from "react-router-dom";
import { isAppRoute } from "../lib/appPaths.js";

/**
 * Router-aware link: uses <Link> for /paths, plain <a> for hashes and external URLs.
 * Hash-only landing links are promoted to the home route when rendered from another page.
 */
export default function AppLink({ to, href, className, children, onClick, ...rest }) {
  const location = useLocation();
  const target = to ?? href ?? "/";
  const isHashOnlyTarget = typeof target === "string" && target.startsWith("#");
  const routeTarget = isHashOnlyTarget && location.pathname !== "/" ? `/${target}` : target;

  if (isAppRoute(routeTarget)) {
    return (
      <Link to={routeTarget} className={className} onClick={onClick} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <a href={routeTarget} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
