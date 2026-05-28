/**
 * Broad answers grounded in AGENT_KNOWLEDGE.md / trusted sources.
 * Rule-based path uses these before mentor handoff.
 */

export const TRUSTED_SOURCES = {
  fafsa: "https://studentaid.gov/h/apply-for-aid/fafsa",
  studentAid: "https://studentaid.gov",
  commonApp: "https://www.commonapp.org",
  bigFuture: "https://bigfuture.collegeboard.org",
  collegeBoard: "https://www.collegeboard.org",
  collegeScorecard: "https://collegescorecard.ed.gov"
};

export const BROAD_ANSWERS = {
  financial: `**FAFSA** (Free Application for Federal Student Aid) is the main federal form for grants, work-study, and federal loans. It usually opens **October 1** for the next academic year — confirm dates on [Federal Student Aid](${TRUSTED_SOURCES.studentAid}). The form typically uses **prior-prior year** tax data. Many colleges also ask for the **CSS Profile** for institutional aid (see College Board / each school's aid page). **Merit scholarships** often have separate deadlines from need-based aid.`,

  collegeList: `A balanced list often includes **safety** schools (your profile is stronger than typical admits), **target/match** schools (you fit the middle of the range), and **reach** schools (selective or your profile is below the middle — still possible, not guaranteed). Choose schools by **fit**: major options, cost/net price, location, size, and culture — not rankings alone. Compare outcomes on [BigFuture](${TRUSTED_SOURCES.bigFuture}) and [College Scorecard](${TRUSTED_SOURCES.collegeScorecard}).`,

  essay: `The Common App **personal statement** is typically up to **650 words** ([Common App](${TRUSTED_SOURCES.commonApp})). Strong essays show one clear story or value with specific detail — not a résumé list. **Supplements** are different for each college; answer each prompt directly. I can explain brainstorming and structure; deeper revision is great with a Prelude mentor.`,

  timeline: `**Early Decision (ED)** is usually **binding** (you commit if admitted — verify each school). **Early Action (EA)** is usually **non-binding**. **Regular Decision** deadlines are often in January–February but vary. **Rolling** schools review until seats fill. Always confirm dates on each college's admissions page and in the Common App.`,

  major: `Most colleges accept **undecided** students or allow major changes later. Explore through courses, activities, and conversations with people in fields you like. Some programs (nursing, engineering at some schools) require applying directly to that school — check each college's policy on [BigFuture](${TRUSTED_SOURCES.bigFuture}).`,

  testOptional: `**Test-optional** means many schools do not require SAT/ACT scores; policies differ by college and year — check each admissions site. When scores are considered, they are usually one part of a holistic review with grades, rigor (AP/IB/dual enrollment), essays, and activities.`,

  transfer: `**Transfer** admissions vary by college: credit evaluation, GPA expectations, essays, and deadlines differ. Use each university's **transfer admissions** page for requirements. Prelude mentors can help you plan coursework and narrative; official rules come from the school.`,

  parent: `Parents can help most with **organization**, **deadlines**, **financial planning** (FAFSA/CSS, net price comparisons), and encouragement — while keeping the **student's voice** in essays and interviews. Comparing **net price** after aid often matters more than sticker price alone ([College Scorecard](${TRUSTED_SOURCES.collegeScorecard})).`,

  mentorship: `PreludeMatch connects you with **current college students** from target schools or similar paths for relatable, practical guidance on lists, essays, timelines, and campus fit.`,

  gettingStarted: `A good start: (1) list goals and constraints (major interests, budget, location), (2) build a rough college list with safeties/targets/reaches, (3) map **deadlines** (EA/ED/RD), (4) plan **FAFSA/CSS** and scholarships, (5) draft essay ideas early. Prelude mentors personalize each step.`,

  stress: `College planning has many moving parts — breaking it into **one next step** (list, deadline, or form) often helps. You can tell me your grade level and biggest worry and we'll narrow focus.`,

  about: `Prelude helps students start the college process with clarity through peer mentors, admissions guidance, essay support, college planning, and financial aid direction.`,

  cssProfile: `The **CSS Profile** (College Board) is a separate financial aid application many private colleges use for **institutional aid**. It is not the same as FAFSA. Requirements and deadlines vary by school — check each college's financial aid page and [College Board](${TRUSTED_SOURCES.collegeBoard}).`
};

export function getBroadAnswer(category, userText = "") {
  if (/\bcss profile\b/i.test(userText)) return BROAD_ANSWERS.cssProfile;
  if (/\b(test.?optional|sat|act)\b/i.test(userText)) return BROAD_ANSWERS.testOptional;
  return BROAD_ANSWERS[category] ?? BROAD_ANSWERS.stress;
}

export function formatAnswerFirst({ broad, preludeNote, closingQuestion }) {
  const parts = [broad, preludeNote, closingQuestion].filter(Boolean);
  return parts.join("\n\n");
}
