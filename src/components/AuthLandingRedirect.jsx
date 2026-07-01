import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { resolveAuthLandingRedirect } from "../../shared/authRecoveryLink.js";

/** Routes Supabase auth hash/query params that land on `/` to the correct auth page. */
export default function AuthLandingRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const target = resolveAuthLandingRedirect({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash
    });
    if (!target) return;
    const current = `${location.pathname}${location.search}${location.hash}`;
    if (target !== current) {
      navigate(target, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}
