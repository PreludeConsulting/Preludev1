import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Globe2,
  Mail,
  MessageSquareText,
  Send,
  Sparkles,
  Video
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import AppLink from "./AppLink.jsx";
import Navbar from "./Navbar.jsx";
import PreludeLogo from "./PreludeLogo.jsx";
import PreludeChat from "./PreludeChat.jsx";
import SignInModal from "./SignInModal.jsx";
import AccountPanel from "./AccountPanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLegalModal } from "../context/LegalModalContext.jsx";
import {
  BOOKING_WINDOW_DAYS,
  CONTACT_EMAIL,
  CONTACT_TIME_ZONE,
  DISCOVERY_CALL_MINUTES,
  buildContactSchedule,
  buildGmailComposeUrl,
  buildMailtoHref,
  formatDateLabel,
  formatMonthLabel,
  formatTimeLabel,
  getAvailableTimes,
  getCalendarCells
} from "../lib/contactSchedule.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SCHEDULE_REFRESH_MS = 60 * 1000;

const studentYearOptions = [
  "8th grade or earlier",
  "9th grade",
  "10th grade",
  "11th grade",
  "12th grade",
  "Transfer student",
  "Parent or guardian",
  "Other"
];

function TimeSlotButton({ time, selected, onClick }) {
  return (
    <button
      type="button"
      className={`contact-time-slot${selected ? " contact-time-slot--selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {formatTimeLabel(time)}
    </button>
  );
}

function getMonthCursorForDate(months, isoDate) {
  if (!isoDate) return 0;
  const monthKey = isoDate.slice(0, 7);
  const index = months.findIndex(({ year, monthIndex }) => `${year}-${String(monthIndex + 1).padStart(2, "0")}` === monthKey);
  return index >= 0 ? index : 0;
}

export default function ContactPage() {
  const { requestPersonalizedAi } = useAuth();
  const { openLegal } = useLegalModal();
  const location = useLocation();
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  const schedule = useMemo(() => buildContactSchedule(scheduleNow), [scheduleNow]);
  const { availableCallSlots, bookingWindow, months: scheduleMonths } = schedule;
  const [monthCursor, setMonthCursor] = useState(() =>
    getMonthCursorForDate(schedule.months, schedule.firstAvailableDate)
  );
  const [selectedDate, setSelectedDate] = useState(schedule.firstAvailableDate);
  const [selectedTime, setSelectedTime] = useState(schedule.firstAvailableTime);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    studentYear: "",
    topic: ""
  });
  const [bookingStatus, setBookingStatus] = useState("idle");
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
    const id = (location.hash || "").replace(/^#/, "");
    if (!id) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.pathname]);

  const safeMonthCursor = Math.min(monthCursor, Math.max(scheduleMonths.length - 1, 0));
  const month = scheduleMonths[safeMonthCursor];
  const selectedDateIsAvailable = Boolean(availableCallSlots[selectedDate]?.length);
  const activeSelectedDate = selectedDateIsAvailable ? selectedDate : schedule.firstAvailableDate;
  const selectedTimes = getAvailableTimes(activeSelectedDate, availableCallSlots);
  const activeSelectedTime = selectedTimes.includes(selectedTime) ? selectedTime : selectedTimes[0] || "";
  const cells = useMemo(
    () => getCalendarCells(month.year, month.monthIndex, availableCallSlots),
    [availableCallSlots, month.monthIndex, month.year]
  );
  const genericEmailHref = buildMailtoHref({
    name: form.name,
    email: form.email,
    studentYear: form.studentYear,
    topic: form.topic
  });
  const genericGmailHref = buildGmailComposeUrl({
    name: form.name,
    email: form.email,
    studentYear: form.studentYear,
    topic: form.topic
  });
  const isBookingLoading = bookingStatus === "loading";
  const bookingCompleted = bookingStatus === "success";
  const canRequestCall = Boolean(activeSelectedDate && activeSelectedTime && form.name.trim() && form.email.trim() && !isBookingLoading && !bookingCompleted);

  useEffect(() => {
    const refreshId = window.setInterval(() => setScheduleNow(new Date()), SCHEDULE_REFRESH_MS);
    return () => window.clearInterval(refreshId);
  }, []);

  useEffect(() => {
    if (safeMonthCursor !== monthCursor) {
      setMonthCursor(safeMonthCursor);
    }

    if (selectedDate !== activeSelectedDate) {
      setSelectedDate(activeSelectedDate);
      setMonthCursor(getMonthCursorForDate(scheduleMonths, activeSelectedDate));
    }

    if (selectedTime !== activeSelectedTime) {
      setSelectedTime(activeSelectedTime);
    }
  }, [
    activeSelectedDate,
    activeSelectedTime,
    monthCursor,
    safeMonthCursor,
    scheduleMonths,
    selectedDate,
    selectedTime
  ]);

  function updateForm(field) {
    return (event) => {
      setBookingStatus("idle");
      setBookingError("");
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  function chooseDate(isoDate) {
    setBookingStatus("idle");
    setBookingError("");
    setSelectedDate(isoDate);
    setSelectedTime(getAvailableTimes(isoDate, availableCallSlots)[0] || "");
  }

  function chooseTime(time) {
    setBookingStatus("idle");
    setBookingError("");
    setSelectedTime(time);
  }

  function changeMonth(direction) {
    setMonthCursor((current) => {
      const next = Math.min(Math.max(current + direction, 0), scheduleMonths.length - 1);
      const nextMonth = scheduleMonths[next];
      const firstAvailableDate = Object.keys(availableCallSlots).find((isoDate) =>
        isoDate.startsWith(`${nextMonth.year}-${String(nextMonth.monthIndex + 1).padStart(2, "0")}`)
      );
      if (firstAvailableDate) {
        setSelectedDate(firstAvailableDate);
        setSelectedTime(getAvailableTimes(firstAvailableDate, availableCallSlots)[0] || "");
      }
      return next;
    });
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function requestCall() {
    if (!canRequestCall) return;

    setBookingStatus("loading");
    setBookingError("");

    try {
      const response = await fetch("/api/contact/book-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedDate: activeSelectedDate,
          selectedTime: activeSelectedTime,
          ...form
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Request failed.");
      }
      setBookingStatus("success");
    } catch (error) {
      setBookingStatus("error");
      setBookingError(error.message || "Request failed.");
    }
  }

  return (
    <div className="contact-page">
      <div className="paper-grain contact-page__grain" aria-hidden="true" />
      <Navbar />
      <main className="contact-page__main" id="book-call">
        <div className="contact-page__eyebrow">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Admissions strategy starts here
        </div>

        <section className="contact-scheduler" aria-labelledby="contact-heading">
          <div className="contact-scheduler__info">
            <div className="contact-brand">
              <PreludeLogo className="prelude-logo--contact" />
            </div>

            <div className="contact-scheduler__summary">
              <p className="contact-scheduler__host">Prelude Admissions Team</p>
              <h1 id="contact-heading">Discovery Call</h1>
              <ul className="contact-scheduler__facts" aria-label="Call details">
                <li>
                  <Clock3 className="h-5 w-5" aria-hidden="true" />
                  <span>{DISCOVERY_CALL_MINUTES} min</span>
                </li>
                <li>
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                  <span>
                    Monday-Friday, 10 AM-4 PM. Saturday, 12 PM-3 PM. Book up to a week and a half ahead.
                  </span>
                </li>
                <li>
                  <Video className="h-5 w-5" aria-hidden="true" />
                  <span>Web conferencing details provided after confirmation.</span>
                </li>
                <li>
                  <Mail className="h-5 w-5" aria-hidden="true" />
                  <span>We reply from {CONTACT_EMAIL}.</span>
                </li>
              </ul>
            </div>

            <div className="contact-scheduler__links">
              <AppLink href="/" className="contact-link">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Prelude
              </AppLink>
              <button type="button" className="contact-link" onClick={() => openLegal("privacy")}>
                Privacy Policy
              </button>
            </div>
          </div>

          <div className="contact-scheduler__booking">
            <div className="contact-calendar-header">
              <div>
                <p className="contact-section-label">Select a Date & Time</p>
                <h2>{formatMonthLabel(month.year, month.monthIndex)}</h2>
              </div>
              <div className="contact-calendar-header__controls">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  disabled={safeMonthCursor === 0}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  disabled={safeMonthCursor === scheduleMonths.length - 1}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="contact-calendar" aria-label={`${formatMonthLabel(month.year, month.monthIndex)} availability`}>
              {WEEKDAYS.map((day) => (
                <div className="contact-calendar__weekday" key={day}>
                  {day}
                </div>
              ))}
              {cells.map((cell) =>
                cell.day ? (
                  <button
                    type="button"
                    key={cell.key}
                    className={`contact-calendar__day${cell.available ? " contact-calendar__day--available" : ""}${cell.isoDate === activeSelectedDate ? " contact-calendar__day--selected" : ""}`}
                    disabled={!cell.available}
                    onClick={() => chooseDate(cell.isoDate)}
                    aria-label={cell.available ? `${formatDateLabel(cell.isoDate)} available` : `${formatDateLabel(cell.isoDate)} unavailable`}
                    aria-pressed={cell.isoDate === activeSelectedDate}
                  >
                    {cell.day}
                  </button>
                ) : (
                  <span className="contact-calendar__blank" key={cell.key} aria-hidden="true" />
                )
              )}
            </div>

            <div className="contact-timezone">
              <p>Time zone</p>
              <div>
                <Globe2 className="h-4 w-4" aria-hidden="true" />
                <span>
                  {CONTACT_TIME_ZONE}; booking window through {formatDateLabel(bookingWindow.endIsoDate)}
                </span>
              </div>
            </div>

            <section className="contact-time-panel" aria-labelledby="time-panel-heading">
              <div>
                <h3 id="time-panel-heading">{formatDateLabel(activeSelectedDate)}</h3>
                <p>Choose one of the available call windows.</p>
              </div>
              <div className="contact-time-panel__slots">
                {selectedTimes.map((time) => (
                  <TimeSlotButton
                    key={time}
                    time={time}
                    selected={activeSelectedTime === time}
                    onClick={() => chooseTime(time)}
                  />
                ))}
              </div>
            </section>

            <section className="contact-details" aria-labelledby="contact-details-heading">
              <div className="contact-details__heading">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                <div>
                  <h3 id="contact-details-heading">Tell us what to prepare</h3>
                  <p>A little context helps us route you to the right first conversation.</p>
                </div>
              </div>

              <div className="contact-details__grid">
                <label>
                  <span>Name</span>
                  <input type="text" value={form.name} onChange={updateForm("name")} placeholder="Your name" autoComplete="name" />
                </label>
                <label>
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={updateForm("email")} placeholder="you@example.com" autoComplete="email" />
                </label>
                <label>
                  <span>Student year</span>
                  <select value={form.studentYear} onChange={updateForm("studentYear")}>
                    <option value="">Select one</option>
                    {studentYearOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="contact-details__topic">
                  <span>What should we cover?</span>
                  <textarea
                    value={form.topic}
                    onChange={updateForm("topic")}
                    placeholder="Tell us about goals, target schools, essays, testing, tutoring, budget, or where you feel stuck."
                    rows={4}
                  />
                </label>
              </div>

              <div className="contact-confirm">
                <div>
                  <p className="contact-confirm__label">Selected time</p>
                  <p>{formatDateLabel(activeSelectedDate)} at {formatTimeLabel(activeSelectedTime)}</p>
                </div>
                <button
                  type="button"
                  onClick={requestCall}
                  disabled={!canRequestCall}
                  className={`contact-button contact-button--primary contact-confirm__button${canRequestCall ? "" : " contact-button--disabled"}`}
                  aria-disabled={!canRequestCall}
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {bookingCompleted ? "Request sent" : isBookingLoading ? "Sending..." : "Request this time"}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {bookingStatus === "success" ? (
                <p className="contact-form-status contact-form-status--success" role="status">
                  Request received. We sent the appointment details to Prelude support.
                </p>
              ) : null}
              {bookingStatus === "error" ? (
                <p className="contact-form-status contact-form-status--error" role="alert">
                  {bookingError} You can still email us below.
                </p>
              ) : null}
              {!canRequestCall && !isBookingLoading && !bookingCompleted ? (
                <p className="contact-form-status" role="status">Add your name and email to request this time.</p>
              ) : null}
            </section>
          </div>
        </section>

        <section className="contact-email-section" id="email-us" aria-labelledby="email-us-heading">
          <div className="contact-email-card">
            <div>
              <p className="contact-email-card__eyebrow">Email us</p>
              <h2 id="email-us-heading">Prefer to write first?</h2>
              <p>
                Send a question about mentoring, pricing, essays, SAT/ACT prep, tutoring, or parent support.
              </p>
            </div>
            <div className="contact-email-card__actions">
              <a href={genericGmailHref} target="_blank" rel="noopener noreferrer" className="contact-button contact-button--primary">
                <Send className="h-4 w-4" aria-hidden="true" />
                Open Gmail
              </a>
              <a href={genericEmailHref} className="contact-button contact-button--secondary">
                <Mail className="h-4 w-4" aria-hidden="true" />
                Open email app
              </a>
              <button type="button" className="contact-button contact-button--ghost" onClick={copyEmail}>
                {copied ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Copied" : "Copy email"}
              </button>
            </div>
          </div>
        </section>
      </main>
      <PreludeChat />
      <SignInModal />
      <AccountPanel onOpenPersonalizedAi={requestPersonalizedAi} />
    </div>
  );
}
