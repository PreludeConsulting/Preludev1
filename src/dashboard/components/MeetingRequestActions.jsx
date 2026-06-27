import { useState } from "react";
import { useDashboardData } from "../context/DashboardDataContext.jsx";
import JoinZoomButton from "./JoinZoomButton.jsx";
import { isValidZoomJoinUrl, normalizeZoomJoinUrl } from "../../lib/zoomMeetingLinks.js";
import { PrimaryButton, SecondaryButton } from "./ui/index.jsx";

export default function MeetingRequestActions({ request, acceptClassName = "", declineClassName = "" }) {
  const { acceptMeetingRequest, declineMeetingRequest } = useDashboardData();
  const [accepting, setAccepting] = useState(false);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [zoomJoinUrl, setZoomJoinUrl] = useState("");
  const [error, setError] = useState("");

  async function handleConfirmAccept() {
    const normalized = normalizeZoomJoinUrl(zoomJoinUrl);
    if (!isValidZoomJoinUrl(normalized)) {
      setError("Paste a valid Zoom link (https://zoom.us/j/…).");
      return;
    }

    setAccepting(true);
    setError("");
    try {
      await acceptMeetingRequest(request, normalized);
      setShowAcceptForm(false);
      setZoomJoinUrl("");
    } catch (err) {
      setError(err?.message || "Could not accept this meeting request.");
    } finally {
      setAccepting(false);
    }
  }

  if (showAcceptForm) {
    return (
      <div className="dash-meetings-requests__accept-form">
        <label className="prelude-field dash-meetings-requests__link-field">
          <span>Zoom meeting link</span>
          <input
            type="url"
            value={zoomJoinUrl}
            onChange={(e) => setZoomJoinUrl(e.target.value)}
            placeholder="https://zoom.us/j/1234567890"
            autoComplete="off"
            disabled={accepting}
          />
          <em className="dash-field-hint">Create the meeting in Zoom, then paste the join link.</em>
        </label>
        <div className="dash-meetings-requests__accept-form-actions">
          <PrimaryButton type="button" className={acceptClassName} disabled={accepting} onClick={handleConfirmAccept}>
            {accepting ? "Scheduling…" : "Confirm & schedule"}
          </PrimaryButton>
          <SecondaryButton type="button" className={declineClassName} disabled={accepting} onClick={() => setShowAcceptForm(false)}>
            Cancel
          </SecondaryButton>
        </div>
        {error ? <p className="dash-schedule-form__form-error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <>
      <PrimaryButton type="button" className={acceptClassName} onClick={() => setShowAcceptForm(true)}>
        Accept
      </PrimaryButton>
      <SecondaryButton type="button" className={declineClassName} onClick={() => declineMeetingRequest(request.id)}>
        Decline
      </SecondaryButton>
    </>
  );
}
