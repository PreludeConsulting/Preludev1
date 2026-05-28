import {
  ArrowUp,
  BookOpen,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Compass,
  DollarSign,
  ExternalLink,
  GraduationCap,
  MessageCircle,
  MoreHorizontal,
  Sparkles,
  Users,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getUserBaseRecord } from "../lib/auth.js";
import { createInitialMessages, getAgentReply, getTypingDelay } from "../lib/preludeAgent.js";
import { applyChatInsights } from "../lib/userProfile.js";
import { cn } from "../lib/utils.js";
import FormattedChatText from "./FormattedChatText.jsx";

const SERVICE_ICONS = {
  users: Users,
  compass: Compass,
  book: BookOpen,
  dollar: DollarSign,
  calendar: CalendarCheck
};

function PreludeAvatar({ className }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
        className
      )}
      aria-hidden="true"
    >
      <Sparkles className="h-4 w-4" />
    </div>
  );
}

function ResourceCarousel({ carousel }) {
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    updateScroll();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);
    return () => {
      el.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, [carousel, updateScroll]);

  const scrollBy = (dir) => {
    trackRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  };

  const isMentors = carousel.type === "mentors";
  const Icon = isMentors ? GraduationCap : Compass;

  return (
    <div className="prelude-carousel mt-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>{carousel.title}</span>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {carousel.count ?? carousel.items.length} results
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </span>
      </div>

      <div className="relative">
        {canScrollLeft ? (
          <button
            type="button"
            className="prelude-carousel__nav prelude-carousel__nav--left"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}

        <div ref={trackRef} className="prelude-carousel__track" role="list">
          {carousel.items.map((item) =>
            isMentors ? (
              <a
                key={item.id}
                href={item.href}
                className="prelude-carousel__card"
                role="listitem"
              >
                <div className="prelude-carousel__media">
                  <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <div className="prelude-carousel__dots" aria-hidden="true">
                    <span className="bg-foreground" />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="prelude-carousel__body">
                  <p className="text-xs text-muted-foreground">{item.school}</p>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.major}</p>
                  <p className="mt-1 text-xs font-medium text-primary">{item.focus}</p>
                </div>
              </a>
            ) : (
              <a
                key={item.id}
                href={item.href}
                className="prelude-carousel__card prelude-carousel__card--service"
                role="listitem"
              >
                {(() => {
                  const SvcIcon = SERVICE_ICONS[item.icon] ?? Compass;
                  return <SvcIcon className="mb-2 h-5 w-5 text-primary" aria-hidden="true" />;
                })()}
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </a>
            )
          )}
        </div>

        {canScrollRight ? (
          <button
            type="button"
            className="prelude-carousel__nav prelude-carousel__nav--right"
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ChatBubble({ message, onQuickReply }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser ? <PreludeAvatar className="mt-1 h-8 w-8" /> : null}
      <div className={cn("max-w-[88%] space-y-2", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-6",
            isUser
              ? "bg-muted text-foreground"
              : "border border-foreground/10 bg-background text-foreground shadow-sm"
          )}
        >
          {isUser ? (
            <p>{message.text}</p>
          ) : (
            <FormattedChatText text={message.text} />
          )}
        </div>

        {!isUser && message.carousel ? <ResourceCarousel carousel={message.carousel} /> : null}

        {!isUser && message.quickReplies?.length ? (
          <div className="flex flex-wrap gap-2">
            {message.quickReplies.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-full border border-foreground/12 bg-background px-3 py-1.5 text-left text-xs font-medium text-foreground transition hover:bg-foreground/[0.04]"
                onClick={() => onQuickReply(item.label)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2">
      <PreludeAvatar className="mt-1 h-8 w-8" />
      <div className="flex items-center gap-1 rounded-2xl border border-foreground/10 bg-background px-4 py-3 shadow-sm">
        <span className="prelude-typing-dot" />
        <span className="prelude-typing-dot prelude-typing-dot--delay" />
        <span className="prelude-typing-dot prelude-typing-dot--delay-2" />
      </div>
    </div>
  );
}

export default function PreludeChat() {
  const { user, isAuthenticated, openSignIn, openAccount, personalizedAiRequest, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => createInitialMessages());
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setMessages(createInitialMessages(user));
  }, [user?.email, user?.plan]);

  useEffect(() => {
    if (!personalizedAiRequest) return;
    setOpen(true);
    setMessages(createInitialMessages(user));
    setMenuOpen(false);
  }, [personalizedAiRequest, user]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [open, messages, typing, scrollToBottom]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || typing) return;

      const userMsg = {
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
        createdAt: Date.now()
      };

      let historyWithUser;
      setMessages((prev) => {
        historyWithUser = [...prev, userMsg];
        return historyWithUser;
      });
      setInput("");
      setTyping(true);

      try {
        const reply = await getAgentReply(trimmed, historyWithUser, user);
        const delay = getTypingDelay(reply.text);
        window.setTimeout(() => {
          setMessages((prev) => [...prev, reply]);
          setTyping(false);
          if (user?.email && reply.category) {
            applyChatInsights(user.email, {
              category: reply.category,
              userText: trimmed,
              baseRecord: getUserBaseRecord(user.email)
            });
            refreshUser();
          }
        }, delay);
      } catch {
        setTyping(false);
      }
    },
    [typing, user, refreshUser]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const resetChat = () => {
    setMessages(createInitialMessages(user));
    setMenuOpen(false);
    setTyping(false);
  };

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
            aria-label="Open Prelude AI chat"
          >
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
            <span className="prelude-chat-launcher__label">Prelude AI</span>
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
            transition={{ duration: 0.28, ease: "easeOut" }}
            role="dialog"
            aria-label="Prelude AI assistant"
          >
            <header className="prelude-chat-header">
              <div className="flex items-center gap-3">
                <PreludeAvatar />
                <div>
                  <p className="font-body text-sm font-semibold text-foreground">Prelude AI</p>
                  <p className="font-body text-xs text-muted-foreground">
                    {isAuthenticated ? `Prelude AI · ${user.planName} plan` : "AI assistant"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {isAuthenticated ? (
                  <button
                    type="button"
                    className="hidden max-w-[7rem] truncate rounded-full px-3 py-1.5 text-xs font-medium text-foreground/80 transition hover:bg-foreground/[0.05] sm:inline"
                    onClick={openAccount}
                  >
                    {user.name.split(" ")[0]} · {user.planName}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="hidden rounded-full px-3 py-1.5 text-xs font-medium text-foreground/80 transition hover:bg-foreground/[0.05] sm:inline"
                    onClick={openSignIn}
                  >
                    Sign in
                  </button>
                )}
                <div className="relative">
                  <button
                    type="button"
                    className="rounded-full p-2 text-foreground/70 transition hover:bg-foreground/[0.05]"
                    aria-label="More options"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuOpen ? (
                    <div className="absolute right-0 top-full z-10 mt-1 min-w-[10rem] rounded-xl border border-foreground/10 bg-background py-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-foreground/[0.04]"
                        onClick={resetChat}
                      >
                        New conversation
                      </button>
                      {isAuthenticated ? (
                        <button
                          type="button"
                          className="block w-full px-4 py-2 text-left text-sm hover:bg-foreground/[0.04]"
                          onClick={() => {
                            setMenuOpen(false);
                            openAccount();
                          }}
                        >
                          My plan & account
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="block w-full px-4 py-2 text-left text-sm hover:bg-foreground/[0.04]"
                          onClick={() => {
                            setMenuOpen(false);
                            openSignIn();
                          }}
                        >
                          Sign in
                        </button>
                      )}
                      <a
                        href="#pricing"
                        className="block px-4 py-2 text-sm hover:bg-foreground/[0.04]"
                        onClick={() => setMenuOpen(false)}
                      >
                        View plans
                      </a>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded-full p-2 text-foreground/70 transition hover:bg-foreground/[0.05]"
                  aria-label="Close chat"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div ref={listRef} className="prelude-chat-messages">
              <p className="prelude-chat-disclaimer">
                This conversation may be recorded to improve Prelude services. See our{" "}
                <a href="#contact" className="underline underline-offset-2">
                  Terms
                </a>{" "}
                and{" "}
                <a href="#contact" className="underline underline-offset-2">
                  Privacy Policy
                </a>
                .
              </p>

              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} onQuickReply={sendMessage} />
              ))}
              {typing ? <TypingIndicator /> : null}
            </div>

            <form className="prelude-chat-input" onSubmit={handleSubmit}>
              <label htmlFor="prelude-chat-text" className="sr-only">
                Message Prelude AI
              </label>
              <input
                id="prelude-chat-text"
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isAuthenticated ? "Ask Prelude AI…" : "How can I help?"}
                autoComplete="off"
                disabled={typing}
              />
              <button
                type="submit"
                className="prelude-chat-send"
                disabled={!input.trim() || typing}
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
