import { Video } from "lucide-react";
import { isValidZoomJoinUrl } from "../../lib/zoomMeetingLinks.js";

export default function JoinZoomButton({
  href,
  className = "dash-btn dash-btn--primary dash-btn--sm",
  label = "Join Meeting"
}) {
  if (!isValidZoomJoinUrl(href)) return null;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      <Video className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}
