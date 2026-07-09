import { useLanguage } from "../../context/LanguageContext.jsx";
import PreludeLogo from "../PreludeLogo.jsx";
import { PIG_MASCOT_SRC } from "./PreludePigAvatar.jsx";
import { EXAMPLE_MENTORS } from "../../data/mentors.js";
import { HERO_DEMO_STEPS } from "./preludeMatchDemoContent.js";
import { getCinematicDurationMs } from "../../lib/preludeMatchCinematicMotion.js";

const mentorStep = HERO_DEMO_STEPS.find((step) => step.id === "mentor");
const dashboardStep = HERO_DEMO_STEPS.find((step) => step.id === "dashboard");
const meetingStep = HERO_DEMO_STEPS.find((step) => step.id === "meeting");
const featuredMentor =
  EXAMPLE_MENTORS.find((mentor) => mentor.name === "Asim Patel") ?? EXAMPLE_MENTORS[0];
const OVERFLOW_COINS = ["25", "20", "35", "+", "50"];
const OVERFLOW_CASH = ["$", "$", "$"];
const OVERFLOW_HATS = Array.from({ length: 4 });

function OpenerLine() {
  const { t } = useLanguage();
  const lines = t("hero.cinematicOpener");

  return (
    <h2 className="shopify-hero__headline pm-cinematic__opener">
      {lines.map((line) => (
        <span key={line} className="shopify-hero__headline-line pm-cinematic__opener-line">
          {line}
        </span>
      ))}
    </h2>
  );
}

function MentorHeader({ compact = false }) {
  const mentor = mentorStep?.mentor;
  if (!mentor) return null;

  return (
    <header className={`pm-cinematic__plan-mentor${compact ? " pm-cinematic__plan-mentor--compact" : ""}`}>
      <span className="pm-cinematic__mentor-avatar" aria-hidden="true">
        <img
          src={featuredMentor.photo}
          alt=""
          width={88}
          height={88}
          decoding="async"
          loading="eager"
          draggable={false}
          style={{ objectPosition: featuredMentor.objectPosition }}
        />
      </span>
      <div className="pm-cinematic__mentor-copy">
        <p className="pm-cinematic__mentor-kicker">Top mentor found</p>
        <strong>{featuredMentor.name}</strong>
        <span>{featuredMentor.university} - {featuredMentor.specialty}</span>
      </div>
      <em className="pm-cinematic__mentor-fit">{mentor.match}</em>
      {!compact ? (
        <ul className="pm-cinematic__mentor-tags" aria-hidden="true">
          {mentor.reasons?.slice(0, 2).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}

export default function PreludeMatchCinematicBeats({ mobile = false }) {
  const tasks = dashboardStep?.tasks ?? [];
  const coins = meetingStep?.coins ?? [];
  const meeting = meetingStep?.meeting;

  return (
    <div
      className="pm-cinematic"
      data-cinematic-duration-ms={getCinematicDurationMs(mobile)}
      aria-hidden="true"
    >
      <div className="pm-cinematic__atmosphere" aria-hidden="true">
        <div className="pm-cinematic__glow pm-cinematic__glow--warm" />
        <div className="pm-cinematic__glow pm-cinematic__glow--accent" />
        <div className="pm-cinematic__vignette" />
        <div className="pm-cinematic__grain" />
      </div>

      <div className="pm-cinematic__camera">
        <section className="pm-cinematic__beat pm-cinematic__beat--opener">
          <OpenerLine />
        </section>

        <div className="pm-cinematic__layer pm-cinematic__layer--progress">
          <div className="pm-cinematic__progress-wrap">
            <div className="pm-cinematic__progress-head">
              <p className="pm-cinematic__progress-label">Mentor profile complete</p>
              <span className="pm-cinematic__progress-value">0%</span>
            </div>
            <div className="pm-cinematic__progress-stage">
              <div className="pm-cinematic__progress-glow" aria-hidden="true" />
              <div className="pm-progress pm-cinematic__progress">
                <div className="pm-progress__fill pm-cinematic__progress-fill" />
              </div>
            </div>
          </div>
        </div>

        <div className="pm-cinematic__assembly">
          <div className="pm-cinematic__layout-root pm-cinematic__layout-root--match">
            <div className="pm-cinematic__layout-item pm-cinematic__layout-item--plan">
              <article className="pm-cinematic__plan">
                <MentorHeader />

                <div className="pm-cinematic__plan-expand">
                  <div className="pm-cinematic__plan-expand-inner">
                    <div className="pm-cinematic__plan-sheet">
                      <p className="pm-cinematic__plan-kicker">Your plan this week</p>

                      <div className="pm-cinematic__plan-row pm-cinematic__plan-row--meeting">
                        <span className="pm-cinematic__plan-row-icon" aria-hidden="true">◷</span>
                        <div className="pm-cinematic__plan-row-copy">
                          <strong>{meeting?.title}</strong>
                          <span>{meeting?.time}</span>
                        </div>
                        <em>{meeting?.action}</em>
                      </div>

                      {tasks.slice(0, 2).map((task, index) => (
                        <div key={task.label} className="pm-cinematic__plan-row pm-cinematic__plan-row--task">
                          <span className="pm-cinematic__task-check">{index === 0 ? "✓" : ""}</span>
                          <div className="pm-cinematic__plan-row-copy">
                            <strong>{task.label}</strong>
                            <span>{task.status}</span>
                          </div>
                        </div>
                      ))}

                      {!mobile ? (
                        <div className="pm-cinematic__reward-bar">
                          {coins.map((coin) => (
                            <span key={coin.label} className="pm-cinematic__reward-pill">
                              <b>{coin.value}</b>
                              <small>{coin.label}</small>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <div className="pm-cinematic__pig-moment">
              <div className="pm-cinematic__pig-bubble">
                Great job.
                <strong>Plan unlocked.</strong>
              </div>
              <img
                className="pm-cinematic__pig"
                src={PIG_MASCOT_SRC}
                alt=""
                aria-hidden="true"
                width={96}
                height={96}
                decoding="async"
                loading="eager"
                draggable={false}
              />
            </div>
          </div>
        </div>

        <section className="pm-cinematic__bank-scene" aria-hidden="true">
          {OVERFLOW_COINS.map((coin, index) => (
            <span key={`coin-${index}`} className="pm-cinematic__bank-coin">{coin}</span>
          ))}
          {OVERFLOW_CASH.map((cash, index) => (
            <span key={`cash-${index}`} className="pm-cinematic__cash-note">{cash}</span>
          ))}
          {OVERFLOW_HATS.map((_, index) => (
            <span key={`hat-${index}`} className="pm-cinematic__grad-hat" />
          ))}
        </section>

        <section className="pm-cinematic__beat pm-cinematic__beat--wordmark">
          <div className="pm-cinematic__wordmark-tech" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="pm-cinematic__wordmark-glow" aria-hidden="true" />
          <PreludeLogo className="prelude-logo pm-cinematic__wordmark" />
        </section>
      </div>
    </div>
  );
}

export function PreludeMatchCinematicStatic() {
  return (
    <PreludeLogo className="prelude-logo prelude-logo--compact pm-cinematic__wordmark" />
  );
}
