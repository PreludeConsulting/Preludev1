const roadmapContent = {
  identity: {
    width: "25%",
    kicker: "Stage 01",
    title: "Shape a personal north star.",
    copy: "Students begin with a guided self-map: strengths, values, activities, target schools, and the kind of future self they want their application to reveal."
  },
  strategy: {
    width: "50%",
    kicker: "Stage 02",
    title: "Turn ambition into a school-specific plan.",
    copy: "Prelude pairs mentor insight with consultant structure so students know where to apply, what each school values, and how to sequence the work."
  },
  essays: {
    width: "75%",
    kicker: "Stage 03",
    title: "Make the story unmistakably theirs.",
    copy: "Drafts move from raw ideas into sharp personal narratives, with feedback that protects the student's voice while raising the level of craft."
  },
  launch: {
    width: "100%",
    kicker: "Stage 04",
    title: "Submit with clarity, not chaos.",
    copy: "Final reviews, aid planning, interview prep, and parent check-ins bring the process to a confident close."
  }
};

const steps = document.querySelectorAll(".journey-step");
const progressLine = document.querySelector(".progress-line");
const panelKicker = document.querySelector("#panel-kicker");
const panelTitle = document.querySelector("#panel-title");
const panelCopy = document.querySelector("#panel-copy");

steps.forEach((step) => {
  step.addEventListener("click", () => {
    const content = roadmapContent[step.dataset.step];
    steps.forEach((item) => item.classList.remove("active"));
    step.classList.add("active");
    progressLine.style.width = content.width;
    panelKicker.textContent = content.kicker;
    panelTitle.textContent = content.title;
    panelCopy.textContent = content.copy;
  });
});

document.querySelector(".lead-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.textContent = "Request received";
  button.disabled = true;
});
