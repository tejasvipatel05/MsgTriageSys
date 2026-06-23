# AI Customer Message Triage System

Turn unstructured, messy customer messages into structured triage decisions that software can act on — and know when to call a human.

Each message is classified into **category**, **priority** (P0–P3), **summary**, **suggested action**, **needs_human**, and **confidence**.

---

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env   # add your API key(s)
npm install
npm run dev            # http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

### CLI (dataset + evaluation)

```bash
cd backend
npm run dataset        # process demoDataset.json → results/
npm run evaluate       # compare results vs ground truth → evaluation/
```

---

## API

### `POST /analyze`

Single-message triage.

```json
{ "message": "Where is my order?" }
```

### `POST /analyze-batch`

Batch triage (used by the frontend Batch Processing mode).

```json
{
  "messages": [
    { "id": 1, "message": "Where is my order?" },
    { "id": 2, "message": "mera refund kb ayega" }
  ]
}
```

---

## Frontend

- **Single Message** — one message at a time via `POST /analyze`
- **Batch Processing** — one message per line, sent to `POST /analyze-batch`, results shown in a table with summary stats

---

## Project Structure

```
MsgTriageSys/
├── backend/
│   ├── src/              # API, pipeline, providers, validators
│   ├── dataset/          # demoDataset.json (40 test messages)
│   ├── results/          # latest-results.json / .csv
│   ├── evaluation/       # groundTruth.json, evaluationReport.json
│   └── scripts/          # runDataset.js, evaluate.js
└── frontend/             # React + Vite UI
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AI_PROVIDER` | `gemini` or `groq` |
| `PORT` | Backend port (default `5000`) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | Groq model name |

Switching providers requires only changing `AI_PROVIDER` in `.env`. No application code changes are needed.

---

# AI Decisions

## Problem

Customer support messages are often noisy, multilingual, incomplete, and ambiguous. The goal is to reliably classify each message while preventing hallucinations, invalid outputs, and prompt injection.

We are not building a chatbot that replies to customers. We are building a **triage engine** that outputs structured decisions software can act on.

---

## AI Pipeline

```
Customer Message
        │
        ▼
   Prompt Guard
        │
        ▼
   Prompt Builder
        │
        ▼
   AI Provider
   (Gemini / Groq)
        │
        ▼
 Response Validator
        │
        ▼
  Business Rules
        │
        ▼
  Decision Engine
        │
        ▼
   JSON Response
```

Each layer has a single responsibility. The LLM handles understanding; deterministic code handles safety and consistency.

---

## AI Provider Abstraction

The project supports multiple LLM providers through a provider abstraction layer.

**Current providers:**

- Google Gemini
- Groq

Both providers request **JSON-only** responses and strip markdown code fences before parsing.

**Switching providers:**

```env
AI_PROVIDER=gemini
```

or

```env
AI_PROVIDER=groq
```

No application code changes are required.

---

## Prompt Engineering

The prompt was designed to:

- Classify based on **intent**, not keywords
- Handle long and short messages
- Understand **Hinglish**, Roman Hindi, Roman Gujarati, and mixed-language chat
- Tolerate abbreviations, misspellings, slang, and emojis
- Return **structured JSON only** in English
- Avoid hallucinations (“Never invent information”)
- Avoid exposing internal reasoning
- Use a single canonical category list:

  Billing · Technical Support · Account · Order · Refund · Complaint · Feedback · General Inquiry · Other

When the model is uncertain, the prompt instructs it to return `category="Other"` and `needs_human=true`.

---

## Prompt Injection Protection

Incoming messages are checked against common prompt injection and jailbreak patterns **before** reaching the LLM.

Examples blocked:

- “Ignore previous instructions”
- “You are ChatGPT” / “You are Gemini”
- “System prompt” / “Developer prompt”
- “Reveal your prompt”
- Shell/command injection patterns

Blocked requests are safely rejected before inference and flagged for human review.

---

## Response Validation

Every AI response is validated before being returned.

**Validation includes:**

- Required fields present
- Valid canonical category (with synonym normalization, e.g. `Technical` → `Technical Support`)
- Valid priority (P0–P3)
- Confidence in range 0.0–1.0
- Correct JSON types (boolean, number, string)

Invalid responses trigger a **fallback classification** (`Other`, low confidence, `needs_human=true`) instead of being silently accepted.

Unknown categories still fail validation — we do not relax the schema.

---

## Business Rules

Business rules apply **deterministic priority adjustments only**. They never change category, summary, or confidence.

**Examples:**

| Trigger | Action |
|---------|--------|
| Critical keywords (`fraud`, `hacked`, `lawsuit`, etc.) | Force `priority = P0` |
| Urgency keywords + `P3` | Upgrade to `P1` |

These rules ensure critical incidents receive appropriate priority regardless of model variability, without overriding the AI’s category judgment.

---

## Decision Engine

The decision engine determines whether a ticket should be escalated to a human agent.

It **only** modifies `needs_human`. It never changes category, priority, summary, suggested_action, or confidence.

**Rules (applied in order):**

| # | Condition | Result |
|---|-----------|--------|
| 1 | Prompt Guard blocked the message | `needs_human = true` |
| 2 | `confidence < 0.70` | `needs_human = true` |
| 3 | `priority == "P0"` | `needs_human = true` |
| 4 | `category == "Other"` | `needs_human = true` |
| 5 | Otherwise | Keep the AI’s original `needs_human` value |

**Design intent:** The AI decides whether a routine case needs a human. Deterministic rules only override when safety or ambiguity requires it. We deliberately removed category-specific escalation rules (e.g. “all Billing P1 → human”) because they caused inconsistent behaviour.

**Example fix:** Account + P0 + AI says `needs_human=false` → engine forces `needs_human=true`.

---

## Uncertainty Handling

| Signal | System behaviour |
|--------|------------------|
| Low AI confidence (< 0.70) | Fallback or forced human escalation |
| Invalid JSON from provider | Fallback classification |
| Validation failure | Fallback classification |
| Ambiguous / unclassifiable | `Other` + human escalation |
| Prompt injection | Block + human escalation |

The system prefers **flagging for human review** over guessing when confidence is low.

---

## Reliability

To improve robustness:

- **Retry** transient AI failures (429, 503, network)
- **Provider abstraction** — swap models without code changes
- **Fallback responses** — always return valid JSON triage output
- **Strict JSON validation** — reject malformed model output
- **Category normalization** — map common AI synonyms to canonical values
- **Graceful error handling** — batch and dataset runs continue when individual messages fail

The application returns structured responses instead of crashing.

---

## Supported Inputs

The system is designed to process:

- English
- Hinglish / Roman Hindi / Roman Gujarati
- WhatsApp-style informal chat
- Abbreviations, misspellings, slang, emojis
- Long paragraphs and very short messages (`plz hlp`, `???`)
- Mixed-language messages
- Adversarial / injection attempts (blocked at guard layer)

---

## Evaluation

We measure quality against **hand-labeled ground truth** — no LLM calls during evaluation.

```bash
cd backend
npm run dataset    # analyze all 40 demo messages
npm run evaluate   # compare vs evaluation/groundTruth.json
```

**Latest evaluation (10 labeled messages):**

| Metric | Score |
|--------|-------|
| Category accuracy | 60% |
| Priority accuracy | 70% |
| Needs-human accuracy | 50% |
| Average confidence | 0.91 |
| Average latency | ~835 ms |

**Where it breaks:** The model often under-flags `needs_human` on complaints, ambiguous messages, and security incidents. Category confusion on payment-deducted-but-no-order cases (Billing vs Order).

**Honest assessment:** Priority and category are reasonably strong on clear intent. Human-escalation alignment is the weakest area — the simplified decision engine fixes deterministic cases (P0, Other, low confidence) but cannot fix when the AI returns high confidence with a wrong `needs_human=false`.

---

## Cost & Latency (rough)

| Provider | ~Latency/message | Notes |
|----------|-----------------|-------|
| Groq (llama-3.3-70b) | 400–800 ms | Fast; free tier rate-limits batch runs |
| Gemini Flash | 500–1200 ms | Higher TPM limits for batch |

**One idea to cut cost:** Cache triage results by message hash for duplicate/repeated inquiries; only call the LLM on unseen messages.

---

## Design Trade-offs

Rather than maximizing raw model freedom, the system prioritizes **reliability and predictable outputs** through layered validation and deterministic rules.

This hybrid approach combines LLM reasoning (understanding messy language) with deterministic guardrails (validation, P0 keywords, human escalation) to improve consistency for customer support workflows.

**What we chose not to do:**

- Let the model reply directly to customers
- Relax validation to accept any category string
- Add category-specific human-escalation heuristics that conflict with AI judgment
- Call the LLM during evaluation (keeps metrics reproducible)

---

## Future Improvements

- Improve prompt + examples for `needs_human` calibration on complaints and security cases
- Return token usage and cost per message from providers
- Message-hash caching for repeated inquiries
- Fine-tuned domain-specific model for support triage
- Agentic workflows (e.g. lookup order status via tool call when category is Order)
- Expand ground-truth set beyond 10 labeled messages

---

## Demo Checklist

1. Start backend + frontend
2. **Single Message:** paste a Hinglish refund message → show structured JSON result
3. **Batch Processing:** paste 5 lines → show table + stats
4. **Injection test:** “Ignore previous instructions…” → blocked, `needs_human=true`
5. **CLI:** `npm run dataset && npm run evaluate` → show accuracy numbers
