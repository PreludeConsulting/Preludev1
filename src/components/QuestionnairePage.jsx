import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getPreludeMatchQuestionnaire, savePreludeMatchQuestionnaire } from "../lib/auth.js";
import { Button } from "./ui/button.jsx";

const QUESTIONS = [
  "What is your current grade level in high school?",
  "What is your current unweighted GPA range?",
  "What is your strongest academic subject area?",
  "Which test path are you planning (SAT, ACT, test-optional)?",
  "How many AP/IB/Honors courses will you complete by graduation?",
  "How clear is your intended major right now?",
  "Which college size do you prefer?",
  "Which campus setting do you prefer (urban/suburban/rural)?",
  "How important is attending a top-ranked school to you?",
  "How important is merit scholarship potential for your college list?",
  "Do you plan to apply Early Decision or Early Action?",
  "How much essay support do you think you need?",
  "How confident are you in building a personal narrative?",
  "How strong are your current extracurricular leadership experiences?",
  "How many hours per week can you dedicate to college prep?",
  "How involved do you want your parents/guardians in this process?",
  "Would you value mentor check-ins between live sessions?",
  "How helpful would mentor insight from your target schools be?",
  "How important is matching with a mentor who shares your background?",
  "What industries or careers are you most interested in after college?",
  "How interested are you in undergraduate research opportunities?",
  "How likely are you to pursue graduate school in the future?",
  "How important is internship readiness during college?",
  "How stressed do you currently feel about the admissions timeline?"
];

const SCALE = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

function answersFromSubmission(questionnaire) {
  if (!Array.isArray(questionnaire?.answers)) return {};
  return questionnaire.answers.reduce((nextAnswers, item) => {
    if (Number.isInteger(item.index) && typeof item.answer === "string") nextAnswers[item.index] = item.answer;
    return nextAnswers;
  }, {});
}

export default function QuestionnairePage() {
  const { isAuthenticated, openSignIn, ready } = useAuth();
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const completion = useMemo(() => Math.round((Object.keys(answers).length / QUESTIONS.length) * 100), [answers]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    let cancelled = false;
    getPreludeMatchQuestionnaire()
      .then(({ questionnaire }) => {
        if (!cancelled) setAnswers(answersFromSubmission(questionnaire));
      })
      .catch(() => {
        if (!cancelled) setStatus("Start fresh: we could not find a saved PreludeMatch Questionnaire yet.");
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, ready]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!isAuthenticated) {
      setError("Please sign in before saving your PreludeMatch Questionnaire so we can attach it to your user account.");
      openSignIn();
      return;
    }

    if (Object.keys(answers).length < QUESTIONS.length) {
      setError("Please answer all questions before continuing to pricing.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        completionPercent: completion,
        answers: QUESTIONS.map((question, index) => ({ index, question, answer: answers[index] }))
      };
      await savePreludeMatchQuestionnaire(payload);
      setStatus("Saved to your Prelude account. Redirecting you to pricing…");
      window.location.hash = "#pricing";
    } catch (err) {
      setError(err.message || "We could not save your PreludeMatch Questionnaire.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="section-shell pt-28">
      <div className="hero-dark-stage mx-auto max-w-5xl rounded-[2rem] p-6 md:p-10">
        <p className="section-badge mb-5">PreludeMatch Questionnaire</p>
        <h1 className="section-heading">Find mentors based on your goals, background, and target schools.</h1>
        <p className="body-copy mt-5">
          Complete this form to match with mentors by target schools, shared context, direct access style, and family
          communication preferences. When you submit, we&apos;ll save it to your Prelude account and take you to pricing.
        </p>
        <p className="mt-4 font-body text-sm text-muted-foreground">Completion: {completion}%</p>
        <p className="mt-2 font-body text-xs text-muted-foreground">
          Your submitted answers are stored in PostgreSQL in the <code>prelude_match_questionnaires</code> table linked to
          your <code>users</code> record.
        </p>
        {!isAuthenticated && ready ? (
          <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground">
            Sign in or create a free account before submitting so your mentor-match answers are saved to your profile.
          </div>
        ) : null}
        {error ? <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : null}
        {status ? <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground">{status}</div> : null}

        <form onSubmit={handleSubmit} className="mt-8 grid gap-6">
          {QUESTIONS.map((question, index) => (
            <fieldset className="paper-card rounded-2xl p-5" key={question}>
              <legend className="font-body text-sm font-medium text-foreground">
                {index + 1}. {question}
              </legend>
              <div className="mt-4 flex flex-wrap gap-3">
                {SCALE.map((option) => (
                  <label
                    key={option}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-foreground/20 px-3 py-1.5 text-xs"
                  >
                    <input
                      type="radio"
                      name={`q-${index}`}
                      value={option}
                      checked={answers[index] === option}
                      onChange={() => setAnswers((prev) => ({ ...prev, [index]: option }))}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <div className="flex justify-end">
            <Button as="button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save & See Pricing"}</Button>
          </div>
        </form>
      </div>
    </main>
  );
}
