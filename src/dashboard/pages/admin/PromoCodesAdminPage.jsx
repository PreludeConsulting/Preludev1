import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase.js";

async function adminPromoRequest(path, options = {}) {
  const supabase = getSupabase();
  const session = await supabase?.auth.getSession();
  const token = session?.data?.session?.access_token;
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    credentials: "include"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Promo admin request failed.");
  }
  return payload;
}

export default function PromoCodesAdminPage() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadCodes() {
    setLoading(true);
    setError("");
    try {
      const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const payload = await adminPromoRequest(`/api/admin/promo-codes${query}`);
      setCodes(payload.codes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCodes();
  }, []);

  async function toggleActive(code) {
    await adminPromoRequest(`/api/admin/promo-codes/${code.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !code.active })
    });
    await loadCodes();
  }

  async function revokeCode(code) {
    await adminPromoRequest(`/api/admin/promo-codes/${code.id}`, {
      method: "PATCH",
      body: JSON.stringify({ revoked: true, active: false })
    });
    await loadCodes();
  }

  return (
    <div className="matching-team-page">
      <header className="matching-team-page__header">
        <div>
          <p className="matching-team-page__eyebrow">Admin</p>
          <h1>Promo codes</h1>
          <p>Create, monitor, and revoke complimentary Plus Plan registration codes.</p>
        </div>
        <div className="matching-team-page__actions">
          <input
            type="search"
            className="matching-team-search"
            placeholder="Search code or campaign"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" className="matching-team-button" onClick={loadCodes}>
            Search
          </button>
        </div>
      </header>

      {error ? <p className="matching-team-error" role="alert">{error}</p> : null}
      {loading ? <p>Loading promo codes…</p> : null}

      <div className="matching-team-table-wrap">
        <table className="matching-team-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Campaign</th>
              <th>Redeemed</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => (
              <tr key={code.id}>
                <td>{code.publicCode}</td>
                <td>{code.campaignName || "—"}</td>
                <td>{code.currentRedemptionCount}{code.maxRedemptions ? ` / ${code.maxRedemptions}` : ""}</td>
                <td>{code.revokedAt ? "Revoked" : code.active ? "Active" : "Inactive"}</td>
                <td>{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : "No expiry"}</td>
                <td>
                  <button type="button" className="matching-team-button matching-team-button--ghost" onClick={() => toggleActive(code)}>
                    {code.active ? "Deactivate" : "Activate"}
                  </button>
                  {!code.revokedAt ? (
                    <button type="button" className="matching-team-button matching-team-button--ghost" onClick={() => revokeCode(code)}>
                      Revoke
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
