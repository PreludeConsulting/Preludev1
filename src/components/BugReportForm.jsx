import { ArrowLeft, Bug, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { submitBugReport } from "../lib/bugReports.js";

const CATEGORIES = [
  "Login / signup issue", "Dashboard issue", "Mentor matching issue", "Messaging issue",
  "Meetings / calendar issue", "Payment / subscription issue", "Profile / settings issue", "Other"
];

function initialForm() {
  return { category: "", title: "", description: "", pageUrl: window.location.href };
}

export default function BugReportForm({ onBack }) {
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const account = useMemo(() => user ? { name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(), email: user.email || "", role: user.role || "", userId: user.id || "" } : undefined, [user]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (status !== "idle") { setStatus("idle"); setMessage(""); }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const result = await submitBugReport({
        ...form, account,
        userAgent: navigator.userAgent,
        environment: `${import.meta.env.MODE || "unknown"} · ${window.location.origin}`
      });
      setForm(initialForm());
      setStatus("success");
      setMessage(result.message || "Thanks — your bug report was sent to Prelude Support.");
    } catch {
      setStatus("error");
      setMessage("Something went wrong sending your report. Please try again.");
    }
  }

  return (
    <div className="bug-report">
      <button type="button" className="bug-report__back" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> Back to support</button>
      <div className="bug-report__heading"><span><Bug className="h-4 w-4" /></span><div><h2>Report a Bug</h2><p>Tell us what went wrong and Prelude Support will take a look.</p></div></div>
      <form className="bug-report__form" onSubmit={handleSubmit}>
        <label>Bug category<select required value={form.category} onChange={(event) => update("category", event.target.value)}><option value="" disabled>Select a category</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Short title<input required minLength={3} maxLength={160} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Briefly describe the issue" /></label>
        <label>Description<textarea required minLength={10} maxLength={10000} rows={5} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What happened? What were you trying to do? What did you expect instead?" /></label>
        <label>Page / URL <span>(optional)</span><input type="url" maxLength={2048} value={form.pageUrl} onChange={(event) => update("pageUrl", event.target.value)} /></label>
        {account ? <p className="bug-report__account">Your signed-in account details will be included automatically.</p> : null}
        {message ? <p className={`bug-report__status bug-report__status--${status}`} role="status">{message}</p> : null}
        <button type="submit" className="bug-report__submit" disabled={status === "sending"}><Send className="h-4 w-4" />{status === "sending" ? "Sending…" : "Send bug report"}</button>
      </form>
    </div>
  );
}
