# 🪖 Lone Soldier Benefits Assistant (AI Mini MVP)

A tiny web app that asks a lone soldier a few questions and uses the **OpenAI API**
to return a personalized list of rights & grants they may be eligible for, the
documents to prepare, and a clear next step.

This is a Mini MVP of the larger "Rights & Grants Management System" feature.

## Run locally

```bash
npm install
npm install -g netlify-cli   # if you don't have it
netlify dev
```

Then open http://localhost:8888

> Without an `OPENAI_API_KEY` the app still works — it falls back to an offline
> rule-based estimate.

## Add your OpenAI key (for real AI answers)

Create a file named `.env` in the project root:

```
OPENAI_API_KEY=sk-your-key-here
```

`netlify dev` loads it automatically. In production, set the same variable in the
Netlify dashboard under **Site settings → Environment variables**.

## Deploy

Push to GitHub, connect the repo on [netlify.com](https://netlify.com), and add
`OPENAI_API_KEY` in the environment variables. Netlify serves the static files and
runs `netlify/functions/ai.js` as a serverless function.

## Files

| File | Role |
|------|------|
| `index.html` | The two screens: profile form + results |
| `style.css` | Styling |
| `app.js` | Collects answers, calls the function, renders results |
| `netlify/functions/ai.js` | Calls OpenAI, with key/error fallbacks |
| `netlify.toml` | Netlify config |
| `package.json` | Project metadata / dev dependency |
# lone-soldier-benefits-ai
# lone-soldier-benefits-ai
# lone-soldier-benefits-ai
# lone-soldier-benefits-ai
# lone-soldier-benefits-ai
# lone-soldier-benefits-ai
# lone-soldier-benefits-ai
