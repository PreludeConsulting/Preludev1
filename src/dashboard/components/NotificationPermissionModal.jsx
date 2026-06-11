import { Modal, PrimaryButton, SecondaryButton } from "./ui/index.jsx";

export default function NotificationPermissionModal({ open, onAllow, onDismiss }) {
  return (
    <Modal
      open={open}
      onClose={onDismiss}
      title="Enable notifications?"
      footer={(
        <div className="dash-modal__footer-actions">
          <SecondaryButton type="button" onClick={onDismiss}>Not now</SecondaryButton>
          <PrimaryButton type="button" onClick={onAllow}>Allow notifications</PrimaryButton>
        </div>
      )}
    >
      <p className="dash-notification-permission__body">
        Prelude can remind you before upcoming events and tasks. Allow browser notifications so you don&apos;t miss meetings, deadlines, or important reminders.
      </p>
    </Modal>
  );
}
