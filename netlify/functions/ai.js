// netlify/functions/ai.js
// Serverless function: takes a lone-soldier profile, asks OpenAI which benefits
// they likely qualify for, and returns structured JSON the frontend can render.
// Includes a rule-based fallback so the app keeps working with no API key or on API failure.

const MODEL = "gpt-4o-mini";

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let profile;
  try {
    profile = JSON.parse(event.body || "{}").profile;
  } catch (e) {
    return json(400, { error: "Invalid request body" });
  }
  if (!profile) {
    return json(400, { error: "Missing profile" });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // FALLBACK 1: no API key configured -> return the offline estimate.
  if (!apiKey) {
    return json(200, fallbackResult(profile));
  }

  try {
    const aiResult = await askOpenAI(profile, apiKey);
    return json(200, { ...aiResult, source: "ai" });
  } catch (err) {
    console.error("OpenAI call failed:", err.message);
    // FALLBACK 2: API failed -> still give the user something useful.
    return json(200, fallbackResult(profile));
  }
};

async function askOpenAI(profile, apiKey) {
  const systemPrompt =
    "You are an assistant that helps lone soldiers (חיילים בודדים) in the Israeli " +
    "military understand which rights and grants they are likely eligible for. " +
    "Base your answer on well-known lone-soldier benefits such as the lone soldier " +
    "salary supplement, rent assistance / housing grant, the 'month off' (chodesh chofesh), " +
    "flight tickets home for immigrants, financial grants, and release grants. " +
    "Be encouraging, clear, and practical. Never invent specific amounts or legal guarantees. " +
    "Respond ONLY with valid JSON matching this schema: " +
    '{ "summary": string, ' +
    '"benefits": [{ "name": string, "why": string }], ' +
    '"documents": [string], ' +
    '"nextStep": string }. ' +
    "Use simple language. List 2-5 benefits. 'why' explains in one short sentence why it may apply.";

  const userPrompt =
    "Here is the soldier's profile:\n" +
    `- Lone soldier status: ${profile.loneStatus}\n` +
    `- Service type: ${profile.serviceType}\n` +
    `- Length of service: ${profile.serviceLength}\n` +
    `- Housing: ${profile.housing}\n` +
    `- Extra notes: ${profile.notes || "none"}\n\n` +
    "Return the JSON described in the system message.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("OpenAI HTTP " + response.status + ": " + text);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(content);
  // Normalize so the frontend always gets the expected shape.
  return {
    summary: parsed.summary || "Here is what we found for you:",
    benefits: Array.isArray(parsed.benefits) ? parsed.benefits : [],
    documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    nextStep: parsed.nextStep || "Contact your unit's welfare officer (mashakit tash).",
  };
}

// Simple rule-based fallback used when AI is unavailable.
function fallbackResult(profile) {
  const benefits = [];
  const docs = ["Copy of your military ID (choger)"];

  const isLone =
    profile.loneStatus &&
    profile.loneStatus.toLowerCase().includes("lone soldier");

  if (isLone) {
    benefits.push({
      name: "Lone soldier salary supplement",
      why: "Recognized lone soldiers receive an increased monthly salary.",
    });
    benefits.push({
      name: "Month off (chodesh chofesh) for chores",
      why: "Lone soldiers are entitled to extra days off to handle personal errands.",
    });
    docs.push("Lone soldier recognition certificate");
  }

  if (profile.housing && profile.housing.toLowerCase().includes("renting")) {
    benefits.push({
      name: "Rent assistance / housing grant",
      why: "Lone soldiers who rent independently may receive monthly rent support.",
    });
    docs.push("Signed rental contract");
    docs.push("Bank account details for the transfer");
  }

  if (profile.loneStatus && profile.loneStatus.toLowerCase().includes("immigrant")) {
    benefits.push({
      name: "Flight tickets to visit family abroad",
      why: "Lone soldiers who are new immigrants can receive subsidized flights home.",
    });
  }

  if (profile.serviceLength && profile.serviceLength.toLowerCase().includes("released")) {
    benefits.push({
      name: "Release grant (ma'anak shichrur)",
      why: "Soldiers finishing service are entitled to a discharge grant.",
    });
    docs.push("Discharge certificate (te'udat shichrur)");
  }

  if (benefits.length === 0) {
    benefits.push({
      name: "General welfare consultation",
      why: "Speak with your welfare officer to map out the benefits relevant to you.",
    });
  }

  return {
    source: "fallback",
    summary: "Here is an offline estimate of benefits you may be eligible for.",
    benefits,
    documents: docs,
    nextStep:
      "Contact your unit's welfare officer (mashakit tash) or the lone soldier center to confirm and apply.",
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
