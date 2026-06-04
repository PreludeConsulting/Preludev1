import { Link } from "react-router-dom";
import { isAppRoute } from "../lib/appPaths.js";

/** Router-aware link: uses <Link> for /paths, plain <a> for hashes and external URLs. */
export default function AppLink({ to, href, className, children, onClick, ...rest }) {
  const target = to ?? href ?? "/";

  if (isAppRoute(target)) {
    return (
      <Link to={target} className={className} onClick={onClick} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <a href={target} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
