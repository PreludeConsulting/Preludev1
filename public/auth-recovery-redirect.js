/**
 * Routes Supabase auth email params on "/" to the correct verification/reset pages.
 */
(function () {
  try {
    var pathname = window.location.pathname || "/";
    var search = window.location.search || "";
    var hash = window.location.hash || "";
    var params = new URLSearchParams(search);
    var hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    var type = (params.get("type") || hashParams.get("type") || "").toLowerCase();
    var tokenHash = params.get("token_hash") || hashParams.get("token_hash");

    if (pathname !== "/verify-email" && tokenHash && (type === "signup" || type === "email")) {
      window.location.replace("/verify-email" + search);
      return;
    }

    if (pathname === "/reset-password") return;

    var isRecovery =
      type === "recovery" ||
      params.get("error_code") === "otp_expired" ||
      hashParams.get("error_code") === "otp_expired";

    if (tokenHash && isRecovery) {
      window.location.replace("/reset-password" + search);
      return;
    }

    if (isRecovery) {
      if (params.get("code") || params.get("error") || params.get("error_code")) {
        window.location.replace("/reset-password" + search);
        return;
      }
      if (hashParams.get("token_hash") || hashParams.get("access_token") || hashParams.get("error")) {
        window.location.replace("/reset-password" + search + hash);
      }
    }
  } catch (error) {
    /* ignore */
  }
})();
