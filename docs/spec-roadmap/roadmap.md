# Kova Roadmap

> **Status: v0.5 - core semantics proven. AI uncertainty as a first-class type property works.**
> This document tracks what comes next, in priority order.

---

## Legend

| Symbol | Horizon | Effort |
|--------|---------|--------|
| 🟢 | Near-term | Weeks to months, engineering only |
| 🔵 | Medium-term | Months to a year, architectural work |
| 🟣 | Research | Open questions, research cycles |

---

## 🟢 Near-Term: Complete the Runtime

### Parallel AI execution
The execution graph already identifies independent `AI()` calls. The interpreter should execute them with `Promise.all()` instead of sequentially. **This is the highest-value near-term change** - programs with N independent AI calls currently pay N x latency; they should pay max(latencies).

```kova
// Today: sequential
let pA = AI("classify category", article)   // blocks
let pB = AI("summarize", article)           // blocks
let pC = AI("classify sentiment", article)  // blocks

// After this change: one concurrent round
// total time = max(tA, tB, tC)
```

### Real HTTP execution
Replace the HTTP stub with `fetch()`. The interpreter already constructs the correct request shape - this is a wiring task, not a design task.

### Real database drivers
Implement a Postgres adapter. `connect`, `find`, `insert`, `update` already produce correct AST nodes. Replace stub results with `pg` query execution.

### `try`/`catch` error handling
Any runtime error currently terminates the program. Add `try { } catch err { }` with `err` bound to the error message.

```kova
try {
  GET "https://api.example.com/data" into result
  let prob = AI("classify", result)
  let label = resolve(prob)
  respond { status: 200, body: { label: label } }
} catch err {
  respond { status: 500, body: { error: err } }
}
```

### Multi-provider AI support
Add a provider configuration layer. Support OpenAI and Anthropic alongside Groq. The `groqAI` function is already isolated - this is a contained change.

### Module system
Implement `import` fully: read the target file, run it through the pipeline, bind exported names into the current scope.

---

## 🔵 Medium-Term: Architectural Extensions

### Bytecode compiler + VM
Replace the tree-walk interpreter with a bytecode compiler and VM. Enables constant folding, dead code elimination, and meaningful performance headroom.

### Effect system for `Prob<T>`
Track not just whether a value is `Prob<T>` but which model produced it, what task it represents, and what confidence is associated. Enables static enforcement of trust boundaries.

```kova
// Hypothetical effect-annotated type
let prob: Prob<string, groq, classify> = AI("classify", text)
// Enforces: only resolve Prob values from trusted models
//           require confidence above threshold before use in critical branches
```

### Execution graph visualiser
The graph JSON is already emitted on every run. Build an interactive D3.js viewer. Makes structural program properties visible without reading code.

### Static analysis tooling
Linter operating on AST + execution graph without running the program. Should detect:
- `AI()` calls with no corresponding `resolve()`
- `resolve()` results never used in a condition or response
- Missed parallelism opportunities
- Overly broad task strings

### LSP support
Wrap the existing semantic analyzer in a Language Server Protocol server. Gives VS Code and other editors Kova-aware autocomplete, hover docs, and inline error highlighting.

---

## 🟣 Research Directions

### Execution graphs as POMDP policies
A Kova program that calls `AI()` to estimate state and acts on that estimate is structurally a POMDP policy. If this connection can be formalised, RL research on POMDP optimisation becomes directly applicable, including identifying which `AI()` calls most influence program behaviour.

### Symbolic scaffolding for AI improvement
The execution graph encodes constraints that AI output must satisfy for correct program execution. Those constraints are a candidate reward signal for fine-tuning the underlying model toward outputs that satisfy them. The graph as the interface between the symbolic program and the neural component it calls.

### Calibrated confidence in `Prob<T>`
The `confidence` field is currently a placeholder. Making it meaningful requires either models that report calibrated uncertainty or post-hoc calibration (conformal prediction, temperature scaling). This gives `Prob<T>` a genuine probabilistic interpretation.

### Formal verification of AI-integrated programs
Given a Kova program, a formal model of the AI's output distribution, and a behavioural specification: can a theorem prover verify the program satisfies the specification with high probability? The execution graph is the natural proof representation.

### Influence on mainstream languages
Python, JavaScript, and TypeScript have growing AI integrations with no structural uncertainty handling. Kova is a proof that such a mechanism is possible. The path to impact at scale is publishing the design as a research paper and placing these ideas in mainstream language design discussions.

---

## Current Limitations (v0.5)

- No parallel AI execution (all calls sequential)
- HTTP and database layers are stubs
- No error handling - any runtime error terminates
- `confidence` in `Prob<T>` is a placeholder value
- Single AI provider (Groq)
- No module system

---

## Version History

| Version | Description |
|---------|-------------|
| v0.5 | Core semantics: `Prob<T>` type, `AI()` calls, `resolve()`, execution graph, semantic analysis |