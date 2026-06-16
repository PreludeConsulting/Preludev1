import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { shouldUseDemoFixtures } from "../../lib/devAuthBypass.js";
import { SectionCard, SecondaryButton } from "./ui/index.jsx";
import DeleteAccountModal from "./DeleteAccountModal.jsx";

export function DeleteAccountSection({ user }) {
  const { deleteAccount, finishAccountDeletion, verifyAccountPassword } = useAuth();
  const [open, setOpen] = useState(false);
  const isDemo = shouldUseDemoFixtures(user);

  return (
    <>
      <SectionCard title="Delete account" className="dash-panel dash-panel--danger">
        <div className="dash-delete-account__warning dash-delete-account__warning--inline">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <p>
            Permanently delete your Prelude account and all associated data. This cannot be undone. You will need to
            create a new account to use Prelude again.
          </p>
        </div>
        <SecondaryButton
          type="button"
          className="dash-btn--danger"
          disabled={isDemo}
          onClick={() => setOpen(true)}
        >
          Delete my account
        </SecondaryButton>
        {isDemo ? (
          <p className="dash-muted dash-delete-account__demo-note">Demo accounts cannot be deleted.</p>
        ) : null}
      </SectionCard>

      <DeleteAccountModal
        open={open}
        onClose={() => setOpen(false)}
        user={user}
        onVerifyPassword={(password) => verifyAccountPassword(password)}
        onDeleteAccount={deleteAccount}
        onComplete={finishAccountDeletion}
      />
    </>
  );
}
