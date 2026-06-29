import { useState } from "react";
import { useDashboardData } from "../context/DashboardDataContext.jsx";
import {
  isValidMeetingJoinUrl,
  normalizeZoomJoinUrl
} from "../../lib/zoomMeetingLinks.js";
import { PrimaryButton, SecondaryButton } from "./ui/index.jsx";

const MEETING_TYPE_OPTIONS = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" }
];

function meetingLinkFieldCopy(meetingType) {
  if (meetingType === "google_meet") {
    return {
      label: "Google Meet link",
      placeholder: "https://meet.google.com/abc-defg-hij",
      hint: "Create the meeting in Google Meet first, then paste the join link here.",
      error: "Paste a valid Google Meet link (https://meet.google.com/…)."
    };
  }
  return {
    label: "Zoom meeting link",
    placeholder: "https://zoom.us/j/1234567890",
    hint: "Schedule the meeting in Zoom first, then paste the join link here.",
    error: "Paste a valid Zoom link (https://zoom.us/j/…)."
  };
}

export default function MeetingRequestActions({ request, acceptClassName = "", declineClassName = "" }) {
  const { acceptMeetingRequest, declineMeetingRequest } = useDashboardData();
  const [accepting, setAccepting] = useState(false);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [meetingType, setMeetingType] = useState(request?.meetingType === "google_meet" ? "google_meet" : "zoom");
  const [zoomJoinUrl, setZoomJoinUrl] = useState("");
  const [error, setError] = useState("");
  const linkCopy = meetingLinkFieldCopy(meetingType);

  async function handleConfirmAccept() {
    const normalized = normalizeZoomJoinUrl(zoomJoinUrl);
    if (!isValidMeetingJoinUrl(normalized, meetingType)) {
      setError(linkCopy.error);
      return;
    }

    setAccepting(true);
    setError("");
    try {
      await acceptMeetingRequest(request, normalized, meetingType);
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
        <label className="prelude-field">
          <span>Meeting platform</span>
          <select
            value={meetingType}
            onChange={(e) => {
              setMeetingType(e.target.value);
              setError("");
            }}
            disabled={accepting}
          >
            {MEETING_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="prelude-field dash-meetings-requests__link-field">
          <span>{linkCopy.label}</span>
          <input
            type="url"
            value={zoomJoinUrl}
            onChange={(e) => setZoomJoinUrl(e.target.value)}
            placeholder={linkCopy.placeholder}
            autoComplete="off"
            disabled={accepting}
          />
          <em className="dash-field-hint">{linkCopy.hint}</em>
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
