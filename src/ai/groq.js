/**
 * Kova AI Layer — Groq backend
 *
 * AI(task, input)         → Prob<T>  (async, settles on call)
 * AI(task, input, schema) → Prob<T>  (structured JSON output)
 *
 * Prob<T> is a plain object:
 *   { __prob__: true, value: T, confidence: number, model: string, task: string, resolved: false }
 *
 * resolve(prob) unwraps it → T   (marks it resolved, throws if not a Prob)
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

// ── Prob<T> type ──────────────────────────────────────────────────────────────

export function makeProb(value, meta = {}) {
    return {
        __prob__:    true,
        value,
        confidence:  meta.confidence  ?? 1.0,
        model:       meta.model       ?? "unknown",
        task:        meta.task        ?? "",
        tokens:      meta.tokens      ?? 0,
        resolved:    false,
    };
}

export function isProb(v) {
    return v !== null && typeof v === "object" && v.__prob__ === true;
}

export function resolveProb(v) {
    if (!isProb(v)) throw new Error("resolve() expects a Prob<T> value, got: " + typeof v);
    v.resolved = true;
    return v.value;
}

// ── Groq client ───────────────────────────────────────────────────────────────

export async function groqAI(task, input, schema = null, apiKey = null) {
    const key = apiKey ?? process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY not set. Add it to your .env or pass via ENV.GROQ_API_KEY");

    // Build system prompt based on whether structured output is requested
    const systemPrompt = schema
        ? `You are a precise AI assistant. Complete the task and respond ONLY with valid JSON matching this schema: ${JSON.stringify(schema)}. No explanation, no markdown, just JSON.`
        : `You are a precise AI assistant. Complete the task concisely. Respond with just the answer, no preamble.`;

    const userPrompt = `Task: ${task}\nInput: ${typeof input === "object" ? JSON.stringify(input) : String(input)}`;

    const body = {
        model:       DEFAULT_MODEL,
        max_tokens:  512,
        temperature: 0.2,
        messages: [
            { role: "system",  content: systemPrompt },
            { role: "user",    content: userPrompt   },
        ],
    };

    const res = await fetch(GROQ_API_URL, {
        method:  "POST",
        headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content ?? "";
    const tokens = data.usage?.total_tokens ?? 0;
    const model  = data.model ?? DEFAULT_MODEL;

    // Parse JSON if schema was requested
    let value;
    if (schema) {
        try {
            value = JSON.parse(raw.replace(/```json|```/g, "").trim());
        } catch {
            throw new Error(`AI() schema parse failed. Raw response: ${raw}`);
        }
    } else {
        value = raw.trim();
    }

    return makeProb(value, { confidence: 0.9, model, task, tokens });
}

// ── Stub for offline / test mode ──────────────────────────────────────────────

export function stubAI(task, input, schema = null) {
    const value = schema
        ? Object.fromEntries(Object.keys(schema).map(k => [k, `[stub:${k}]`]))
        : `[AI stub: ${task}]`;
    return makeProb(value, { confidence: 1.0, model: "kova-stub", task });
}
