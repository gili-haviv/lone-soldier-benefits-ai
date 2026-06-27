// app.js

function show(el) { el.classList.remove("hidden"); el.style.display = ""; }
function hide(el) { el.classList.add("hidden"); }
const LANG_NAMES = { en: "English", he: "Hebrew", ru: "Russian", fr: "French", es: "Spanish" };
function getLang() {
  const code = document.getElementById("lang-select").value;
  return LANG_NAMES[code] || "English";
}

// ── tab switching ─────────────────────────────────────────────────────────────
function switchToTab(name) {
  const btn = document.querySelector(`.tab[data-tab="${name}"]`);
  if (btn) {
    btn.click();
    document.querySelector(".tab-nav").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.add("hidden");
      p.style.display = "none";
    });
    btn.classList.add("active");
    const panel = document.getElementById("tab-" + btn.dataset.tab);
    panel.classList.remove("hidden");
    panel.style.display = "block";
    panel.classList.remove("animate-in");
    void panel.offsetWidth; // reflow to restart animation
    panel.classList.add("animate-in");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — RIGHTS & GRANTS
// ═══════════════════════════════════════════════════════════════════════════════
const form          = document.getElementById("profile-form");
const formScreen    = document.getElementById("form-screen");
const loading       = document.getElementById("loading");
const errorBox      = document.getElementById("error");
const errorText     = document.getElementById("error-text");
const resultsScreen = document.getElementById("results-screen");
const sourceBadge   = document.getElementById("source-badge");
const resultsSummary = document.getElementById("results-summary");
const benefitsList  = document.getElementById("benefits-list");
const documentsList = document.getElementById("documents-list");
const missingList   = document.getElementById("missing-list");
const processText   = document.getElementById("process-text");
const nextStep      = document.getElementById("next-step");

const LABELS = {
  loneStatus: {
    lone_from_israel: "Lone soldier from Israel (no supporting family in Israel)",
    lone_immigrant:   "Lone soldier who is a new immigrant (oleh chadash)",
    not_sure:         "Not sure if recognized as a lone soldier",
    no:               "Not a lone soldier",
  },
  serviceType: {
    combat:         "Combat role",
    combat_support: "Combat support role",
    non_combat:     "Non-combat role",
  },
  serviceLength: {
    "0-6m":   "Less than 6 months of service",
    "6-12m":  "6 to 12 months of service",
    "12m+":   "More than a year of service",
    released: "Recently released from service",
  },
  housing: {
    rent_alone:      "Renting an apartment alone",
    rent_shared:     "Renting with roommates",
    adoptive_family: "Living with an adoptive family",
    dorm:            "Living in army dorm / base housing",
    other:           "Other housing situation",
  },
};

const CHECK_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function buildProfile(formData) {
  return {
    loneStatus:    LABELS.loneStatus[formData.get("loneStatus")]       || "Unknown",
    serviceType:   LABELS.serviceType[formData.get("serviceType")]     || "Unknown",
    serviceLength: LABELS.serviceLength[formData.get("serviceLength")] || "Unknown",
    housing:       LABELS.housing[formData.get("housing")]             || "Unknown",
    unit:          (formData.get("unit")  || "").trim(),
    notes:         (formData.get("notes") || "").trim(),
  };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const profile = buildProfile(new FormData(form));
  hide(formScreen);
  hide(errorBox);
  hide(resultsScreen);
  show(loading);

  try {
    const res = await fetch("/.netlify/functions/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "rights", profile, lang: getLang() }),
    });
    if (!res.ok) throw new Error("Server error " + res.status);
    const data = await res.json();
    renderRights(data);
    hide(loading);
    show(resultsScreen);
  } catch (err) {
    console.error(err);
    hide(loading);
    errorText.textContent = "Something went wrong. Please try again.";
    show(errorBox);
  }
});

function renderRights(data) {
  sourceBadge.className = "badge " + (data.source === "ai" ? "ai" : "fallback");
  sourceBadge.textContent = data.source === "ai" ? "AI Generated" : "Offline Estimate";
  show(sourceBadge);

  resultsSummary.textContent = data.summary || "Here is what we found for you:";

  benefitsList.innerHTML = "";
  (data.benefits || []).forEach((b) => {
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="b-check">${CHECK_SVG}</span>` +
      `<div><span class="b-title">${b.name}</span><span class="b-why">${b.why}</span></div>`;
    benefitsList.appendChild(li);
  });

  documentsList.innerHTML = "";
  (data.documents || []).forEach((d) => {
    const li = document.createElement("li");
    li.textContent = d;
    documentsList.appendChild(li);
  });

  missingList.innerHTML = "";
  const missing = data.missingDocuments || [];
  if (missing.length === 0) {
    const li = document.createElement("li");
    li.textContent = "None identified";
    missingList.appendChild(li);
  } else {
    missing.forEach((d) => {
      const li = document.createElement("li");
      li.textContent = d;
      missingList.appendChild(li);
    });
  }

  processText.textContent = data.process || "";
  nextStep.textContent = data.nextStep || "Contact your unit's welfare officer (mashakit tash).";
}

document.getElementById("restart-btn").addEventListener("click", () => {
  hide(resultsScreen);
  show(formScreen);
});
document.getElementById("retry-btn").addEventListener("click", () => {
  hide(errorBox);
  show(formScreen);
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — MENTOR
// ═══════════════════════════════════════════════════════════════════════════════
const chatMessages = document.getElementById("chat-messages");
const chatForm     = document.getElementById("chat-form");
const chatInput    = document.getElementById("chat-input");

const AVATAR_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

const chatHistory = [];

function appendMsg(role, content) {
  const wrap = document.createElement("div");
  wrap.className = "msg msg-" + role;
  if (role === "assistant") {
    wrap.innerHTML =
      `<div class="msg-avatar">${AVATAR_SVG}</div>` +
      `<div class="msg-bubble">${content}</div>`;
  } else {
    wrap.innerHTML = `<div class="msg-bubble">${content}</div>`;
  }
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

function appendTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg msg-assistant thinking";
  wrap.innerHTML =
    `<div class="msg-avatar">${AVATAR_SVG}</div>` +
    `<div class="msg-bubble"><span class="typing-dots"><span></span><span></span><span></span></span></div>`;
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;
  chatInput.value = "";

  chatHistory.push({ role: "user", content: question });
  appendMsg("user", question);
  const thinking = appendTyping();

  try {
    const res = await fetch("/.netlify/functions/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "mentor", history: chatHistory, lang: getLang() }),
    });
    if (!res.ok) throw new Error("Server error " + res.status);
    const data = await res.json();
    thinking.remove();
    const answer = data.answer || "Sorry, I couldn't get an answer right now.";
    chatHistory.push({ role: "assistant", content: answer });
    appendMsg("assistant", answer);
  } catch (err) {
    chatHistory.pop();
    console.error(err);
    thinking.remove();
    appendMsg("assistant", "I'm having trouble connecting right now — please try again in a moment. For urgent support, call ERAN at 1201 (free, 24/7).");
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — LEASE SHIELD
// ═══════════════════════════════════════════════════════════════════════════════
const leaseFormSection = document.getElementById("lease-form-section");
const leaseLoading     = document.getElementById("lease-loading");
const leaseError       = document.getElementById("lease-error");
const leaseErrorText   = document.getElementById("lease-error-text");
const leaseResults     = document.getElementById("lease-results");
const leaseSourceBadge = document.getElementById("lease-source-badge");
const leaseSummary     = document.getElementById("lease-summary");
const leaseClauses     = document.getElementById("lease-clauses");

document.getElementById("lease-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = document.getElementById("lease-text").value.trim();
  if (!text) return;

  hide(leaseError);
  hide(leaseResults);
  show(leaseLoading);

  try {
    const res = await fetch("/.netlify/functions/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "lease", leaseText: text, lang: getLang() }),
    });
    if (!res.ok) throw new Error("Server error " + res.status);
    const data = await res.json();
    renderLease(data);
    hide(leaseLoading);
    show(leaseResults);
  } catch (err) {
    console.error(err);
    hide(leaseLoading);
    leaseErrorText.textContent = "Something went wrong. Please try again.";
    show(leaseError);
  }
});

const RISK_ICONS = { red: "🔴", yellow: "🟡", green: "🟢" };
const RISK_ORDER = { red: 0, yellow: 1, green: 2 };

function renderLease(data) {
  leaseSourceBadge.className = "badge " + (data.source === "ai" ? "ai" : "fallback");
  leaseSourceBadge.textContent = data.source === "ai" ? "AI Generated" : "Offline Estimate";
  show(leaseSourceBadge);

  leaseSummary.textContent = data.summary || "Here is the analysis of your contract:";

  const clauses = (data.clauses || []).slice().sort(
    (a, b) => (RISK_ORDER[a.risk] ?? 3) - (RISK_ORDER[b.risk] ?? 3)
  );

  leaseClauses.innerHTML = "";
  clauses.forEach((c) => {
    const risk = c.risk || "green";
    const div = document.createElement("div");
    div.className = "clause clause-" + risk;

    const header = document.createElement("div");
    header.className = "clause-header";
    header.innerHTML =
      `<span class="clause-header-dot"></span>${c.title || "Clause"}` +
      `<span class="clause-chevron">▾</span>`;

    const body = document.createElement("div");
    body.className = "clause-body";
    body.innerHTML =
      `<p class="clause-issue">${c.issue || ""}</p>` +
      (c.suggestion ? `<p class="clause-suggestion">💡 <strong>Suggested wording:</strong> ${c.suggestion}</p>` : "");

    header.addEventListener("click", () => div.classList.toggle("open"));

    div.appendChild(header);
    div.appendChild(body);
    leaseClauses.appendChild(div);

    if (risk === "red") div.classList.add("open");
  });
}

document.getElementById("lease-restart-btn").addEventListener("click", () => {
  hide(leaseResults);
  document.getElementById("lease-text").value = "";
  show(leaseFormSection);
});
document.getElementById("lease-retry-btn").addEventListener("click", () => {
  hide(leaseError);
  show(leaseFormSection);
});
