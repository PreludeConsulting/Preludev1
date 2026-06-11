import { CircleHelp, MoreHorizontal, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLegalModal } from "../context/LegalModalContext.jsx";
import { navigateChatHref } from "../lib/chatLinkSecurity.js";
import GuidedAssistant from "./GuidedAssistant.jsx";

export default function PreludeChat() {
  const { user, isAuthenticated, openSignIn, openAccount } = useAuth();
  const { openLegal } = useLegalModal();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  function handleNavigate(href) {
    const navigated = navigateChatHref(href);
    if (navigated && href === "#preludematch") setOpen(false);
  }

  return (
    <>
      <AnimatePresence>
        {!open ? (
          <motion.button
            key="launcher"
            type="button"
            className="prelude-chat-launcher"
            onClick={() => setOpen(true)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            aria-label="Open Prelude guided assistant"
          >
            <CircleHelp className="h-7 w-7" />
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="panel"
            className="prelude-chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            role="dialog"
            aria-label="Prelude guided admissions assistant"
          >
            <header className="prelude-chat-header">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-foreground">Prelude Guide</p>
                  <p className="font-body text-xs text-muted-foreground">Guided admissions assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="relative">
                  <button type="button" className="rounded-full p-2 text-foreground/70 hover:bg-foreground/[0.05]" aria-label="More options" onClick={() => setMenuOpen((value) => !value)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuOpen ? (
                    <div className="absolute right-0 top-full z-10 mt-1 min-w-[10rem] rounded-xl border border-foreground/10 bg-background py-1 shadow-lg">
                      <button type="button" className="block w-full px-4 py-2 text-left text-sm hover:bg-foreground/[0.04]" onClick={() => { setSessionKey((value) => value + 1); setMenuOpen(false); }}>
                        Start over
                      </button>
                      <button type="button" className="block w-full px-4 py-2 text-left text-sm hover:bg-foreground/[0.04]" onClick={() => { setMenuOpen(false); isAuthenticated ? openAccount() : openSignIn(); }}>
                        {isAuthenticated ? `${user.name.split(" ")[0]} · Account` : "Sign in"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <button type="button" className="rounded-full p-2 text-foreground/70 hover:bg-foreground/[0.05]" aria-label="Close assistant" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="prelude-chat-messages">
              <GuidedAssistant key={sessionKey} onNavigate={handleNavigate} />
              <p className="prelude-chat-disclaimer">
                Guided responses provide general information. See our{" "}
                <button type="button" className="prelude-chat-disclaimer__link" onClick={() => openLegal("terms")}>Terms</button>{" "}
                and{" "}
                <button type="button" className="prelude-chat-disclaimer__link" onClick={() => openLegal("privacy")}>Privacy Policy</button>.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
