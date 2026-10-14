/* shyju.tech — vanilla JS for the planner preview, waitlist and resource hub.
   No API calls except the optional managed form endpoint below. */

// ---- Settings (see SETUP.md) ------------------------------------------------
const CONFIG = {
  // Google Form that collects waitlist emails (see SETUP.md for how to fill these).
  // These values are public by design — they are not secrets.
  // Leave empty until configured: the waitlist then shows an honest
  // "not open yet" message instead of pretending to save.
  googleForm: {
    action: "https://docs.google.com/forms/d/e/1FAIpQLSfEVb1Jsub_e7ikmqloFIBH4Zb7sJcNtMrY0TNpC7iE10f39A/formResponse",
    emailField: "entry.513896926",  // the Email question
    listField: "entry.1622060311",  // the List question — receives "planner-waitlist"
    answersField: "entry.965832221", // the Answers question — e.g. "I need an idea. | A mobile app. | 2–3 hours."
  },

  // Paid guide — hidden for this release, kept for later.
  buyUrl: "",
  price: "",
};

// ---- Analytics ---------------------------------------------------------------
// Sends custom events to whichever analytics script is present on the page
// (Vercel Web Analytics, Google Analytics or Plausible). No-op if none is.
// Never pass email addresses or other personal data here.
function track(name, data = {}) {
  try {
    if (typeof window.va === "function") window.va("event", { name, data });
    if (typeof window.gtag === "function") window.gtag("event", name, data);
    if (typeof window.plausible === "function") window.plausible(name, { props: data });
  } catch (_) { /* analytics must never break the page */ }
}

// ---- Free resources ----------------------------------------------------------
const RESOURCES = [
  { id: "scorecard", num: "01", tint: "var(--peach)", cat: "Idea & validation", kicker: "Start here",
    title: "Is your app idea worth a weekend?",
    desc: "A practical scorecard and five conversations to have before you write code.",
    meta: ["PDF · 2 pages", "20 min exercise"], file: "resources/idea-validation-scorecard.pdf" },
  { id: "two-weekend", num: "02", tint: "var(--blue)", cat: "Build with AI", kicker: "The game plan",
    title: "The two-weekend build plan",
    desc: "Scope one useful feature, protect your time, and get a small project into real hands.",
    meta: ["PDF · 2 pages", "15 min planning"], file: "resources/two-weekend-build-plan.pdf" },
  { id: "prompts", num: "{ }", tint: "var(--green)", cat: "Build with AI", kicker: "Copy. Adapt. Build.",
    title: "AI prompts for a better first build",
    desc: "Six copy-ready prompts for scoping, coding, reviewing, and debugging your app.",
    meta: ["PDF · 2 pages", "6 useful prompts"], file: "resources/ai-builder-prompt-pack.pdf" },
  { id: "launch-checklist", num: "↗", tint: "var(--lilac)", cat: "Launch & grow", kicker: "Ready to ship?",
    title: "The small-app launch checklist",
    desc: "Check the basics: onboarding, privacy, payments, reliability, and support.",
    meta: ["PDF · 2 pages", "24 launch checks"], file: "resources/small-app-launch-checklist.pdf" },
  { id: "feedback", num: "“ ”", tint: "var(--yellow)", cat: "Idea & validation", kicker: "Talk to people",
    title: "Ask for feedback that helps",
    desc: "A short interview script and a simple log for deciding what to build next.",
    meta: ["PDF · 2 pages", "5 interview prompts"], file: "resources/customer-feedback-workbook.pdf" },
  { id: "first-ten", num: "10", tint: "var(--pink)", cat: "Launch & grow", kicker: "Small audience. Real signal.",
    title: "Find your first 10 users",
    desc: "A focused outreach plan with message templates and a tiny experiment tracker.",
    meta: ["PDF · 2 pages", "7-day experiment"], file: "resources/first-ten-users-playbook.pdf" },
];
const resById = Object.fromEntries(RESOURCES.map(r => [r.id, r]));

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function renderResources() {
  const grid = document.getElementById("res-grid");
  const count = document.getElementById("res-count");
  const q = document.getElementById("res-search").value.trim().toLowerCase();
  const cat = document.querySelector('.filter[aria-pressed="true"]').dataset.cat;
  const list = RESOURCES.filter(r =>
    (cat === "all" || r.cat === cat) &&
    (!q || [r.title, r.desc, r.kicker, r.cat].join(" ").toLowerCase().includes(q)));
  count.textContent = `${list.length} of ${RESOURCES.length} resources`;
  grid.innerHTML = list.length ? list.map(r => `
    <article class="res" id="res-${r.id}">
      <div class="top"><span class="num" style="background:${r.tint}" aria-hidden="true">${esc(r.num)}</span><span class="cat">${esc(r.cat)}</span></div>
      <div class="kick">${esc(r.kicker)}</div>
      <h3>${esc(r.title)}</h3>
      <p>${esc(r.desc)}</p>
      <div class="foot">
        <span class="meta">${r.meta.map(esc).join("<br>")}</span>
        <a class="dl" href="${r.file}" download>Free download ↓<span class="sr-only">: ${esc(r.title)} (PDF)</span></a>
      </div>
    </article>`).join("")
    : `<p class="res-empty">No resources match “${esc(q)}”. Try another word or choose “All resources”.</p>`;
}

document.getElementById("filters").addEventListener("click", e => {
  const btn = e.target.closest(".filter");
  if (!btn) return;
  document.querySelectorAll(".filter").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
  renderResources();
});
document.getElementById("res-search").addEventListener("input", renderResources);
renderResources();

// ---- Planner preview: questions ----------------------------------------------
const QUESTIONS = [
  { key: "stage", text: "Where are you starting?", options: [
    ["idea", "I need an idea."], ["have", "I already have an idea."], ["building", "I have started building."]] },
  { key: "platform", text: "What would you like to build?", options: [
    ["mobile", "A mobile app."], ["web", "A web app."], ["unsure", "I’m not sure yet."]] },
  { key: "time", text: "How much time can you spend each week?", options: [
    ["low", "2–3 hours."], ["mid", "4–6 hours."], ["high", "7+ hours."]] },
];
const LABEL = Object.fromEntries(QUESTIONS.flatMap(q => q.options));

const answers = {};
let step = 0;
let opener = null;

const planner = document.getElementById("planner");
const plannerForm = document.getElementById("planner-form");
const backBtn = document.getElementById("back");
const nextBtn = document.getElementById("next");

function renderStep() {
  const q = QUESTIONS[step];
  document.getElementById("stepcount").textContent = `Step ${step + 1} of ${QUESTIONS.length}`;
  document.getElementById("progressbar").style.width = `${((step + 1) / QUESTIONS.length) * 100}%`;
  document.getElementById("planner-legend").textContent = q.text;
  document.getElementById("options").innerHTML = q.options.map(([val, label]) => `
    <label class="opt"><input type="radio" name="${q.key}" value="${val}" ${answers[q.key] === val ? "checked" : ""}>${esc(label)}</label>`).join("");
  backBtn.disabled = step === 0;
  nextBtn.disabled = !answers[q.key];
  nextBtn.textContent = step === QUESTIONS.length - 1 ? "See example plan →" : "Next →";
  const first = document.querySelector('#options input:checked') || document.querySelector('#options input');
  first && first.focus();
}

document.getElementById("options").addEventListener("change", e => {
  if (e.target.name) { answers[e.target.name] = e.target.value; nextBtn.disabled = false; }
});
backBtn.addEventListener("click", () => { if (step > 0) { step--; renderStep(); } });
plannerForm.addEventListener("submit", e => {
  e.preventDefault();
  if (!answers[QUESTIONS[step].key]) return;
  if (step < QUESTIONS.length - 1) { step++; renderStep(); return; }
  track("planner_questions_completed", { ...answers });
  closeDialog(planner);
  showResults();
});

function openPlanner(trigger) {
  opener = trigger || document.activeElement;
  renderStep();
  planner.showModal();
  renderStep(); // focus the first option now the dialog is open
  track("planner_preview_opened");
}
document.querySelectorAll("[data-open-planner]").forEach(b => b.addEventListener("click", () => openPlanner(b)));
document.getElementById("restart").addEventListener("click", e => {
  for (const k of Object.keys(answers)) delete answers[k];
  step = 0;
  openPlanner(e.currentTarget);
});

// ---- Planner preview: predefined examples (no AI, no research) ---------------
// effort: "S" = fits 2–3 h/week if you keep to the first feature; "M" = more comfortable at 4+ h/week.
const IDEAS = [
  { platform: "mobile", effort: "S", title: "Fee reminders for residents' associations",
    who: "Volunteer treasurers of small residents' associations.",
    problem: "Chasing monthly maintenance payments across WhatsApp messages and paper notes.",
    feature: "A list of flats with a paid / unpaid status for the current month.",
    action: "Ask three treasurers to show you how they tracked last month's payments.",
    res: "feedback" },
  { platform: "mobile", effort: "M", title: "Attendance and fee alerts for home tutors",
    who: "Home tutors teaching a few small batches of students.",
    problem: "Keeping track of attendance and which students' fees are still due.",
    feature: "Mark today's attendance for one batch.",
    action: "Watch one tutor update their current register and note what slows them down.",
    res: "scorecard" },
  { platform: "mobile", effort: "M", title: "Job cards for a small service garage",
    who: "Owners of small two-wheeler or car service garages.",
    problem: "Job details live on paper slips, and customers call to ask for status.",
    feature: "Create a job card with a vehicle number and a status.",
    action: "Visit two garages and ask how a job moves from drop-off to delivery.",
    res: "scorecard" },
  { platform: "mobile", effort: "S", title: "Practice questions for one interview role",
    who: "Graduates preparing for one specific entry-level job interview.",
    problem: "Preparation material is scattered and hard to practise on a phone.",
    feature: "Twenty original practice questions with short explanations.",
    action: "Ask five candidates which topics they found hardest in recent interviews.",
    res: "feedback" },
  { platform: "web", effort: "S", title: "An order page for a home bakery",
    who: "Home bakers who take orders through Instagram or WhatsApp messages.",
    problem: "Orders, delivery dates and advance payments get lost in chats.",
    feature: "An order form that lists orders by delivery date.",
    action: "Ask three home bakers to show how they track this week's orders.",
    res: "scorecard" },
  { platform: "web", effort: "S", title: "Invoice follow-ups for freelancers",
    who: "Freelance designers and developers with a handful of clients.",
    problem: "Forgetting to follow up on unpaid invoices.",
    feature: "A list of invoices with due dates and a ready-to-send reminder message.",
    action: "Ask three freelancers how they currently remember overdue invoices.",
    res: "feedback" },
  { platform: "web", effort: "M", title: "A live token page for a small clinic",
    who: "Receptionists at small, single-doctor clinics.",
    problem: "Crowded waiting rooms because patients can't see whose turn it is.",
    feature: "A page showing the current token number, updated by the receptionist.",
    action: "Ask one clinic how they call patients today and what goes wrong.",
    res: "scorecard" },
];

const TIME_TEXT = { low: "2–3 hours a week", mid: "4–6 hours a week", high: "7+ hours a week" };

function pickIdeas({ platform, time }) {
  let pool = platform === "unsure" ? IDEAS : IDEAS.filter(i => i.platform === platform);
  // Less time → smaller scope first; more time → the slightly bigger ideas first.
  const rank = i => (time === "low" ? (i.effort === "S" ? 0 : 1) : time === "high" ? (i.effort === "M" ? 0 : 1) : 0);
  pool = [...pool].sort((a, b) => rank(a) - rank(b));
  if (platform === "unsure") {
    // Keep a mix: at least one web and one mobile direction.
    const web = pool.find(i => i.platform === "web"), mob = pool.find(i => i.platform === "mobile");
    pool = [web, mob, ...pool.filter(i => i !== web && i !== mob)];
  }
  return pool.slice(0, 3);
}

function fitNote(idea, time) {
  if (idea.effort === "S") return "Small first version. Workable at 2–3 hours a week if you stick to the first feature.";
  return time === "low"
    ? "Bigger first version. At 2–3 hours a week, expect it to take a few more weekends — or shrink the first feature."
    : "Moderate first version. Fits 4+ hours a week if you keep the first feature narrow.";
}

const PLATFORM_STEP = {
  mobile: ["Share a test build", "Use the stores' testing tracks (for example Google Play internal testing or TestFlight). Check each store's current testing requirements before you plan dates."],
  web: ["Share a preview link", "Deploy to a free hosting tier so testers can open it on their phones without installing anything."],
  unsure: ["Decide mobile or web with one question", "Does the core task need phone features such as the camera, notifications or offline use? If not, a web app is usually quicker to test."],
};

const PLANS = {
  have: {
    title: "Next steps: test your idea before you build",
    intro: "You already have an idea. The most useful next step is checking that the problem is real and frequent for a specific group of people.",
    steps: {
      low: [
        ["Write the problem as one sentence", "Who has it, how often, and how they handle it today. About 30 minutes.", "scorecard"],
        ["Talk to two people this week", "Ask about the last time the problem happened, not about your app.", "feedback"],
        ["Talk to three more next week, then score it", "Use the evidence, including anything that argues against the idea.", "scorecard"],
        ["Only then pick one first feature", "With 2–3 hours a week, plan a few weekends for a small first version.", "two-weekend"],
      ],
      mid: [
        ["This weekend: problem sentence and five conversations", "Book short calls or visits with people who have the problem.", "feedback"],
        ["Score the idea and choose one workflow", "If the evidence is weak, change the problem before writing code.", "scorecard"],
        ["Next two weekends: build the smallest end-to-end path", "Use AI for bounded tasks and review its output.", "two-weekend"],
        ["Ask one tester to try it without your help", "Note where they hesitate and what breaks.", "feedback"],
      ],
      high: [
        ["This weekend: five conversations and a sketch", "Validate the problem, then sketch the main screen and one success state.", "scorecard"],
        ["Weekend 2: build the main path with sample data", "Keep a 'not now' list for everything else.", "two-weekend"],
        ["Weekend 3: real input, a test, and safe defaults", "Add validation, clear errors and a short getting-started note.", "prompts"],
        ["Share a limited release with a few real users", "Run a small, honest outreach experiment.", "first-ten"],
      ],
    },
  },
  building: {
    title: "Next steps: get what you've built into real hands",
    intro: "You've started building. The most useful next step is usually to stop adding features and learn from a real user.",
    steps: {
      low: [
        ["Freeze new features for two weeks", "Write everything else on a 'not now' list.", "two-weekend"],
        ["Find one tester who has the problem", "Watch them try the main task without guidance.", "feedback"],
        ["Fix only the two issues that block the task", "Choose from what you observed, not your wish list.", "two-weekend"],
        ["Run the basic launch checks", "Clear errors, input validation, and no secrets in client code.", "launch-checklist"],
      ],
      mid: [
        ["Test the main task with three users", "One task each, no help, and notes on where they hesitate.", "feedback"],
        ["Fix the top blockers and review with AI", "Ask for a careful review of correctness and data handling.", "prompts"],
        ["Go through the launch checklist", "Pay attention to privacy, reliability and support.", "launch-checklist"],
        ["Start a small first-users experiment", "Pick one channel where your users already talk.", "first-ten"],
      ],
      high: [
        ["Run three to five short user tests", "Record completions, blockers and follow-ups.", "feedback"],
        ["Fix blockers, then complete the launch checklist", "Make loading, empty, error and success states clear.", "launch-checklist"],
        ["Run a 7-day first-ten-users experiment", "Set your success threshold before you see the results.", "first-ten"],
        ["Review and choose one next improvement", "Base it on what users did, not on compliments.", "scorecard"],
      ],
    },
  },
};

function resLink(id) {
  const r = resById[id];
  return r ? ` <a class="res-link" href="#res-${r.id}">Use: ${esc(r.title)} →</a>` : "";
}

function showResults() {
  const { stage, platform, time } = answers;
  document.getElementById("answer-chips").innerHTML =
    QUESTIONS.map(q => `<span class="chip">${esc(LABEL[answers[q.key]])}</span>`).join("");
  const out = document.getElementById("results");

  if (stage === "idea") {
    out.innerHTML = `
      <p class="lead" style="margin-bottom:22px">Three example directions for someone with ${esc(TIME_TEXT[time])}. They are starting points to investigate — not validated ideas with proven demand.</p>
      <div class="ideas">${pickIdeas(answers).map(i => `
        <article class="idea">
          <div class="tagline">${i.platform === "web" ? "Web app" : "Mobile app"} · example</div>
          <h3>${esc(i.title)}</h3>
          <dl>
            <div><dt>Who it could help</dt><dd>${esc(i.who)}</dd></div>
            <div><dt>Problem it could address</dt><dd>${esc(i.problem)}</dd></div>
            <div><dt>One small first feature</dt><dd>${esc(i.feature)}</dd></div>
            <div><dt>First action this weekend</dt><dd>${esc(i.action)}${resLink(i.res)}</dd></div>
          </dl>
          <p class="fit">${esc(fitNote(i, time))}</p>
        </article>`).join("")}
      </div>`;
  } else {
    const plan = PLANS[stage];
    const steps = [...plan.steps[time]];
    const [pTitle, pText] = PLATFORM_STEP[platform];
    // Where the platform step goes: "decide mobile or web" before building starts,
    // "share a test build / preview link" just before the first person tries it.
    const POS = { have: { low: [3, 4], mid: [2, 3], high: [1, 3] }, building: { low: [0, 1], mid: [0, 0], high: [0, 0] } };
    const [decideAt, shareAt] = POS[stage][time];
    steps.splice(platform === "unsure" ? decideAt : shareAt, 0, [pTitle, pText, null]);
    out.innerHTML = `
      <div class="plan">
        <h3>${esc(plan.title)}</h3>
        <p class="small" style="font-size:16px">${esc(plan.intro)} Paced for ${esc(TIME_TEXT[time])}.</p>
        <ol>${steps.map(([t, d, r]) => `<li><div><b>${esc(t)}</b><span>${esc(d)}${r ? resLink(r) : ""}</span></div></li>`).join("")}</ol>
      </div>`;
  }

  const section = document.getElementById("preview");
  section.hidden = false;
  opener = null; // results take focus; don't send it back to the trigger button
  // Wait until the dialog has fully closed and restored focus, then move to the results.
  setTimeout(() => {
    document.getElementById("preview-h").focus({ preventScroll: true });
    section.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, 50);
  renderNextBox();
  track("planner_results_viewed", { ...answers });
}

// ---- Dialog helpers ----------------------------------------------------------
function closeDialog(dlg) {
  dlg.close();
}
document.querySelectorAll("dialog").forEach(dlg => {
  dlg.addEventListener("click", e => {
    if (e.target.closest("[data-close]") || e.target === dlg) closeDialog(dlg); // ✕ button or backdrop
  });
  dlg.addEventListener("close", () => {
    // Return focus to the button that opened the dialog, unless results took focus.
    if (opener && document.activeElement === document.body && document.body.contains(opener)) opener.focus();
  });
});

// ---- "What's coming" after the results ---------------------------------------
const COMING = {
  idea: [
    "Suggest ideas that suit your skills and %TIME%.",
    "Help you check competitors, with links to the sources.",
    "Help you plan short conversations with real users.",
    "Turn the best idea into a weekend build plan.",
  ],
  have: [
    "List the assumptions behind your idea and plan customer interviews.",
    "Help you check competitors, with links to the sources.",
    "Define a small MVP — and what to leave out.",
    "Write a development brief for your AI coding assistant.",
  ],
  building: [
    "Cut your MVP down to what users actually need.",
    "Write a development brief for your AI coding assistant.",
    "Give you a weekend build plan paced for %TIME%.",
    "Plan your launch and first-user outreach.",
  ],
};
const PLATFORM_TEXT = { mobile: "your mobile app", web: "your web app", unsure: "your app" };

function renderNextBox() {
  const { stage, platform, time } = answers;
  const items = COMING[stage].map(t => t.replace("%TIME%", TIME_TEXT[time]));
  document.getElementById("next-box").innerHTML = `
    <div class="next-box">
      <div>
        <span class="soon">Coming soon</span>
        <h3>The full app planner will:</h3>
        <p class="for">Planned for ${esc(PLATFORM_TEXT[platform])}, with ${esc(TIME_TEXT[time])}.</p>
        <ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
      </div>
      <form data-signup="results" novalidate>
        <label for="results-email">Get an email when the app planner is ready</label>
        <div class="form-row">
          <input id="results-email" type="email" name="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" required aria-describedby="results-status" placeholder="you@example.com">
          <div class="hp" aria-hidden="true"><label>Leave empty<input type="text" name="_gotcha" tabindex="-1" autocomplete="off"></label></div>
          <button class="btn btn-red" type="submit" data-label="Notify me">Notify me</button>
        </div>
        <p class="status" id="results-status" role="status" aria-live="polite"></p>
        <p class="fine">Your answers above are saved with your email so the planner fits what you need. No spam, no payment.</p>
      </form>
    </div>`;
  watchNextBox();
}

// Log once per result when at least half of the "Coming soon" box is on screen.
let nextBoxObserver = null;
function watchNextBox() {
  if (!("IntersectionObserver" in window)) return;
  if (nextBoxObserver) nextBoxObserver.disconnect();
  const box = document.querySelector(".next-box");
  const seenWith = { ...answers };
  nextBoxObserver = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      track("next_box_seen", seenWith);
      nextBoxObserver.disconnect();
    }
  }, { threshold: 0.5 });
  nextBoxObserver.observe(box);
}

// ---- Waitlist (shared by the results form and the "Notify me" pop-up) ----------
const notifyDlg = document.getElementById("notify");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

document.querySelectorAll("[data-open-notify]").forEach(b => b.addEventListener("click", () => {
  opener = b;
  track("notify_clicked", { from: b.closest("section")?.id || "page" });
  const form = document.getElementById("notify-form");
  setStatus(form, "", "");
  form.elements.email.removeAttribute("aria-invalid");
  notifyDlg.showModal();
  form.elements.email.focus();
}));

function setStatus(form, msg, kind) {
  const el = form.querySelector(".status");
  el.textContent = msg;
  el.className = "status" + (kind ? " " + kind : "");
}

function setLoading(form, on) {
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = on;
  form.setAttribute("aria-busy", String(on));
  btn.innerHTML = on ? '<span class="spinner" aria-hidden="true"></span> Sending…' : btn.dataset.label;
}

function googleFormReady() {
  const g = CONFIG.googleForm || {};
  const id = /^entry\.\d+$/;
  return /\/formResponse$/.test(g.action || "") && id.test(g.emailField || "") &&
    (!g.listField || id.test(g.listField)) && (!g.answersField || id.test(g.answersField));
}

function answersText() {
  return QUESTIONS.every(q => answers[q.key]) ? QUESTIONS.map(q => LABEL[answers[q.key]]).join(" | ") : "";
}

// Sends one signup to the Google Form. list: "planner-waitlist" here; a future
// starter-kit form should pass "starter-kit" so the two stay separate.
// Google Forms doesn't allow websites to read its response, so this confirms the
// request was sent (and catches network failures), not that Google stored it —
// test the form once after any change (SETUP.md).
async function submitSignup(email, list, honeypot, answersSummary) {
  if (!googleFormReady()) {
    const err = new Error("not-configured");
    err.code = "not-configured";
    throw err;
  }
  if (honeypot) return "skipped"; // spam bot filled the hidden field: pretend success, send nothing
  const g = CONFIG.googleForm;
  const body = new URLSearchParams({ [g.emailField]: email });
  if (g.listField) body.append(g.listField, list);
  if (g.answersField && answersSummary) body.append(g.answersField, answersSummary);
  try {
    await fetch(g.action, { method: "POST", mode: "no-cors", body });
  } catch (_) {
    const err = new Error("network");
    err.code = "network";
    throw err;
  }
}

document.addEventListener("submit", async e => {
  const form = e.target.closest("form[data-signup]");
  if (!form) return;
  e.preventDefault();
  if (form.dataset.sending === "true") return; // ignore repeat submits while a request is in flight
  const input = form.elements.email;
  const email = input.value.trim();
  if (!EMAIL_RE.test(email)) {
    input.setAttribute("aria-invalid", "true");
    setStatus(form, "Please enter a valid email address, like name@example.com.", "error");
    input.focus();
    return;
  }
  input.removeAttribute("aria-invalid");
  setStatus(form, "", "");
  setLoading(form, true);
  form.dataset.sending = "true";
  try {
    const result = await submitSignup(email, "planner-waitlist", form.elements._gotcha.value, answersText());
    setStatus(form, "Thanks! You're on the list. We'll email you when the app planner is ready.", "success");
    input.value = "";
    if (result !== "skipped") track("waitlist_submitted", { from: form.dataset.signup }); // no email or personal data
  } catch (err) {
    const msg = {
      "not-configured": "Sign-ups aren't open yet, so your email was not saved. Please check back soon.",
      "network": "Couldn't send — please check your internet connection and try again.",
    }[err.code] || "Something went wrong and your email was not saved. Please try again.";
    setStatus(form, msg, "error");
  } finally {
    form.dataset.sending = "false";
    setLoading(form, false);
  }
});

// ---- Paid guide (hidden this release) ----------------------------------------
(() => {
  const buy = document.getElementById("buy");
  if (CONFIG.buyUrl) { buy.href = CONFIG.buyUrl; buy.target = "_blank"; buy.rel = "noopener"; }
  else { buy.removeAttribute("href"); }
  if (CONFIG.price) { const p = document.getElementById("price"); p.textContent = CONFIG.price; p.hidden = false; }
})();
