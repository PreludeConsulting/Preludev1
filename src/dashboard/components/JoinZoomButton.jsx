import { Video } from "lucide-react";
import { inferMeetingTypeFromUrl, isValidMeetingJoinUrl } from "../../lib/zoomMeetingLinks.js";

export default function JoinZoomButton({
  href,
  meetingType,
  className = "dash-btn dash-btn--primary dash-btn--sm",
  label = "Join Meeting"
}) {
  const resolvedType = meetingType || inferMeetingTypeFromUrl(href) || "zoom";
  if (!isValidMeetingJoinUrl(href, resolvedType)) return null;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      <Video className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}
