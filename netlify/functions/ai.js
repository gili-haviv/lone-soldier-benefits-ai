// netlify/functions/ai.js
// Single serverless function handling three modes: "rights", "mentor", "lease".
// Reads OPENAI_API_KEY_lone_soldier (your key name) or OPENAI_API_KEY as fallback.

const MODEL = "gpt-4o-mini";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "Invalid request body" });
  }

  const { mode, lang = "English" } = body;
  const apiKey =
    process.env.OPENAI_API_KEY_lone_soldier || process.env.OPENAI_API_KEY;

  if (mode === "rights") {
    const { profile } = body;
    if (!profile) return json(400, { error: "Missing profile" });
    if (!apiKey) return json(200, fallbackRights(profile));
    try {
      const result = await rightsAI(profile, lang, apiKey);
      return json(200, { ...result, source: "ai" });
    } catch (err) {
      console.error("OpenAI rights error:", err.message);
      return json(200, fallbackRights(profile));
    }
  }

  if (mode === "mentor") {
    const { question } = body;
    if (!question) return json(400, { error: "Missing question" });
    if (!apiKey) return json(200, { answer: fallbackMentor(question), source: "fallback" });
    try {
      const answer = await mentorAI(question, lang, apiKey);
      return json(200, { answer, source: "ai" });
    } catch (err) {
      console.error("OpenAI mentor error:", err.message);
      return json(200, { answer: fallbackMentor(question), source: "fallback" });
    }
  }

  if (mode === "lease") {
    const { leaseText } = body;
    if (!leaseText) return json(400, { error: "Missing leaseText" });
    if (!apiKey) return json(200, fallbackLease());
    try {
      const result = await leaseAI(leaseText, lang, apiKey);
      return json(200, { ...result, source: "ai" });
    } catch (err) {
      console.error("OpenAI lease error:", err.message);
      return json(200, fallbackLease());
    }
  }

  if (mode === "debug") {
    const keyFound = !!apiKey;
    const keyPreview = keyFound ? apiKey.slice(0, 8) + "..." : "NOT SET";
    if (!keyFound) return json(200, { keyFound, keyPreview, openaiStatus: "skipped — no key" });
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: "Bearer " + apiKey },
      });
      const text = await res.text();
      return json(200, { keyFound, keyPreview, openaiStatus: res.status === 200 ? "OK" : "ERROR " + res.status, detail: res.status !== 200 ? text.slice(0, 300) : undefined });
    } catch (err) {
      return json(200, { keyFound, keyPreview, openaiStatus: "FETCH_FAILED", detail: err.message });
    }
  }

  return json(400, { error: "Unknown mode" });
};

// ── helpers ──────────────────────────────────────────────────────────────────

async function callOpenAI(messages, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("OpenAI HTTP " + res.status + ": " + text);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return JSON.parse(content);
}

async function callOpenAIText(messages, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.6,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("OpenAI HTTP " + res.status + ": " + text);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ── mode: rights ─────────────────────────────────────────────────────────────

async function rightsAI(profile, lang, apiKey) {
  const system =
    `You are an assistant helping lone soldiers (חיילים בודדים) in the Israeli military understand their rights and grants. ` +
    `Respond entirely in ${lang}. ` +
    `Base answers on well-known lone-soldier benefits: salary supplement, rent/housing grant, chodesh chofesh (month off), ` +
    `flight tickets for immigrants, financial grants, release grant (ma'anak shichrur). ` +
    `Never invent specific amounts or legal guarantees. ` +
    `Respond ONLY with valid JSON matching exactly: ` +
    `{ "summary": string, "benefits": [{ "name": string, "why": string }], ` +
    `"documents": [string], "missingDocuments": [string], "process": string, "nextStep": string }. ` +
    `benefits: 2-5 items. missingDocuments: list documents the soldier likely hasn't submitted yet based on their profile.`;

  const user =
    `Soldier profile:\n` +
    `- Status: ${profile.loneStatus}\n` +
    `- Service type: ${profile.serviceType}\n` +
    `- Length: ${profile.serviceLength}\n` +
    `- Housing: ${profile.housing}\n` +
    `- Unit: ${profile.unit || "not specified"}\n` +
    `- Notes: ${profile.notes || "none"}\n\nReturn the JSON.`;

  const parsed = await callOpenAI([
    { role: "system", content: system },
    { role: "user", content: user },
  ], apiKey);

  return {
    summary:          parsed.summary          || "Here is what we found for you:",
    benefits:         Array.isArray(parsed.benefits)          ? parsed.benefits          : [],
    documents:        Array.isArray(parsed.documents)         ? parsed.documents         : [],
    missingDocuments: Array.isArray(parsed.missingDocuments)  ? parsed.missingDocuments  : [],
    process:          parsed.process          || "",
    nextStep:         parsed.nextStep         || "Contact your unit's welfare officer (mashakit tash).",
  };
}

function fallbackRights(profile) {
  const benefits = [];
  const docs = ["Copy of your military ID (choger)"];
  const isLone = profile.loneStatus && profile.loneStatus.toLowerCase().includes("lone soldier");

  if (isLone) {
    benefits.push({ name: "Lone soldier salary supplement", why: "Recognized lone soldiers receive an increased monthly salary." });
    benefits.push({ name: "Month off (chodesh chofesh)", why: "Lone soldiers are entitled to extra days off for personal errands." });
    docs.push("Lone soldier recognition certificate");
  }
  if (profile.housing && profile.housing.toLowerCase().includes("renting")) {
    benefits.push({ name: "Rent assistance / housing grant", why: "Lone soldiers who rent may receive monthly rent support." });
    docs.push("Signed rental contract");
    docs.push("Bank account details for the transfer");
  }
  if (profile.loneStatus && profile.loneStatus.toLowerCase().includes("immigrant")) {
    benefits.push({ name: "Flight tickets to visit family abroad", why: "New immigrant lone soldiers can receive subsidized flights home." });
  }
  if (profile.serviceLength && profile.serviceLength.toLowerCase().includes("released")) {
    benefits.push({ name: "Release grant (ma'anak shichrur)", why: "Soldiers finishing service are entitled to a discharge grant." });
    docs.push("Discharge certificate (te'udat shichrur)");
  }
  if (benefits.length === 0) {
    benefits.push({ name: "General welfare consultation", why: "Speak with your welfare officer to map relevant benefits." });
  }

  return {
    source: "fallback",
    summary: "Here is an offline estimate of benefits you may be eligible for.",
    benefits,
    documents: docs,
    missingDocuments: [],
    process: "Contact your unit's welfare officer (mashakit tash) who can guide you through the application process step by step.",
    nextStep: "Contact your unit's welfare officer or the lone soldier center to confirm and apply.",
  };
}

// ── mode: mentor ─────────────────────────────────────────────────────────────

async function mentorAI(question, lang, apiKey) {
  const system =
    `You are a focused AI mentor for lone soldiers (חיילים בודדים) in the Israeli military. ` +
    `Respond entirely in ${lang}. ` +
    `You ONLY answer questions related to: Israeli army life and service, lone soldier rights and benefits, ` +
    `aliyah and new immigrant concerns, military bureaucracy and paperwork, army slang and terminology ` +
    `(pazam, gibush, mashakit tash, keva, milu'im, etc.), emotional support related to army service, ` +
    `housing and financial help for soldiers, and release/discharge processes. ` +
    `If the soldier expresses distress, thoughts of self-harm, or crisis — always refer them to ERAN (dial 1201) and express care. ` +
    `If the question is NOT related to any of these topics, respond ONLY with: ` +
    `"I'm here specifically to help with lone soldier topics — army life, your rights, aliyah, bureaucracy, and support during service. I can't help with [topic], but ask me anything soldier-related!" ` +
    `Do not answer general knowledge, recipes, entertainment, sports, or any unrelated questions under any circumstances. ` +
    `Be concise, warm, and practical. Respond in plain text (not JSON).`;

  return await callOpenAIText([
    { role: "system", content: system },
    { role: "user", content: question },
  ], apiKey);
}

function fallbackMentor(question) {
  return (
    "I'm currently unable to reach the AI. For immediate support call ERAN at 1201 (free, 24/7). " +
    "For army slang and benefits questions, try again in a moment."
  );
}

// ── mode: lease ───────────────────────────────────────────────────────────────

async function leaseAI(leaseText, lang, apiKey) {
  const system =
    `You are a legal assistant specializing in Israeli rental contracts for lone soldiers. ` +
    `Respond entirely in ${lang}. ` +
    `Analyze the contract text for dangerous, unfair, or unusual clauses. ` +
    `Classify each clause as: "red" (dangerous/illegal), "yellow" (risky/unfair), or "green" (standard/fine). ` +
    `Respond ONLY with valid JSON: { "summary": string, "clauses": [{ "title": string, "risk": "red"|"yellow"|"green", "issue": string, "suggestion": string|null }] }. ` +
    `List 3-8 clauses. suggestion should offer safer alternative wording when risk is red or yellow.`;

  const parsed = await callOpenAI([
    { role: "system", content: system },
    { role: "user", content: "Here is the rental contract to analyze:\n\n" + leaseText.slice(0, 8000) },
  ], apiKey);

  return {
    summary: parsed.summary || "Here is the analysis of your contract:",
    clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [],
  };
}

function fallbackLease() {
  return {
    source: "fallback",
    summary: "AI is currently unavailable. Here are common clauses to watch for in Israeli rental contracts.",
    clauses: [
      { title: "Early termination penalty", risk: "red", issue: "Many contracts include heavy penalties for leaving early. Check if this exceeds one month's rent.", suggestion: "Suggest limiting penalty to one month's rent with 30 days notice." },
      { title: "Rent increase clause", risk: "yellow", issue: "Automatic rent increases linked to the index may not be clearly capped.", suggestion: "Add a maximum annual increase cap (e.g. 3%)." },
      { title: "Maintenance responsibility", risk: "yellow", issue: "Contracts often place repair costs on the tenant that legally belong to the landlord.", suggestion: "Specify that structural and infrastructure repairs are landlord's responsibility." },
      { title: "Deposit terms", risk: "yellow", issue: "Deposit return conditions and timeline should be clearly stated.", suggestion: "Add: deposit returned within 30 days of lease end, minus documented damages only." },
    ],
  };
}

// ── json helper ───────────────────────────────────────────────────────────────

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
