import { useEffect, useState } from "react";
import { Download, FileText, ImageOff } from "lucide-react";
import {
  attachmentTypeLabel,
  formatAttachmentSize,
  hasAttachment,
  isImageAttachment
} from "../../../lib/chatAttachments.js";

/**
 * Renders an attachment identically for the sender and the recipient. Both sides
 * receive the same normalized message, so there is no per-account branching here.
 * The image class names are passed in so each chat surface keeps its own layout.
 */
export default function MessageAttachment({
  message,
  linkClassName = "msg-bubble__image-link",
  imageClassName = "msg-bubble__image"
}) {
  const [failed, setFailed] = useState(false);
  const url = message?.attachmentUrl || null;

  // A re-signed URL after expiry deserves a fresh attempt.
  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!hasAttachment(message)) return null;

  const name = message.attachmentName || "Attachment";

  if (isImageAttachment(message) && url && !failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        <img src={url} alt={name} loading="lazy" className={imageClassName} onError={() => setFailed(true)} />
      </a>
    );
  }

  const details = [attachmentTypeLabel(message), formatAttachmentSize(message.attachmentSize)]
    .filter(Boolean)
    .join(" · ");
  const Icon = failed ? ImageOff : FileText;

  const inner = (
    <>
      <span className="msg-attachment__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="msg-attachment__info">
        <span className="msg-attachment__name">{name}</span>
        <span className="msg-attachment__meta">{url ? details : "Unavailable"}</span>
      </span>
      {url ? (
        <span className="msg-attachment__action" aria-hidden="true">
          <Download size={16} />
        </span>
      ) : null}
    </>
  );

  if (!url) {
    return <div className="msg-attachment msg-attachment--missing">{inner}</div>;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" download={name} className="msg-attachment">
      {inner}
    </a>
  );
}
