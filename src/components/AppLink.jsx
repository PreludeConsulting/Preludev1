import { Link, useLocation, useNavigate } from "react-router-dom";
import { isAppRoute } from "../lib/appPaths.js";
import {
  landingRouteForTarget,
  parseLandingTarget,
  scrollToLandingTarget
} from "../lib/landingNavigation.js";

/**
 * Router-aware link: uses <Link> for /paths, plain <a> for hashes and external URLs.
 * Hash-only landing links are promoted to the home route when rendered from another page.
 */
export default function AppLink({ to, href, className, children, onClick, ...rest }) {
  const location = useLocation();
  const navigate = useNavigate();
  const target = to ?? href ?? "/";
  const landingTarget = parseLandingTarget(target);
  const routeTarget = landingRouteForTarget(target, location.pathname);

  function handleClick(event) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    if (landingTarget.kind === "top" && location.pathname === "/") {
      event.preventDefault();
      if (window.location.hash) {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      }
      scrollToLandingTarget(landingTarget.id);
      return;
    }

    if (landingTarget.kind !== "section") return;
    event.preventDefault();
    if (location.pathname === "/" && location.hash === target) {
      scrollToLandingTarget(landingTarget.id);
      return;
    }
    navigate(routeTarget, { state: { landingScroll: true } });
  }

  if (landingTarget.kind === "section") {
    return (
      <Link to={routeTarget} className={className} onClick={handleClick} {...rest}>
        {children}
      </Link>
    );
  }

  if (isAppRoute(routeTarget)) {
    return (
      <Link to={routeTarget} className={className} onClick={handleClick} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <a href={routeTarget} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
