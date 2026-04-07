# Kova Programming Language

Kova is a lightweight, expressive programming language designed for AI-integrated backend workflows. It features clean syntax, web-native primitives, and a predictable execution model , with one key addition no general-purpose language provides: **AI uncertainty as a first-class type**.

As AI systems become more embedded in backend logic, programs need a way to represent what they do not know. Kova introduces `Prob<T>`, a probabilistic type that wraps every AI call result. You cannot use a `Prob<T>` value in a condition or expression until you explicitly call `resolve()` , making uncertainty a structural property of the program, not a runtime surprise.

Kova is a proof-of-concept that deterministic control flow and probabilistic AI calls can coexist with static guarantees, making AI-driven programs easier to audit, debug, and reason about formally.

Made some exmaples, and I am still fleshing out the language spec and writing tests. The README will be updated as the project evolves, but I wanted to get a draft up to share the core ideas and structure.
---

## Overview

Kova is engineered for:

* **Readable, minimal syntax**
* **Built-in HTTP verbs as keywords** (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`)
* **Database-like keywords** (`find`, `insert`, `update`, `connect`, `into`, `save`)
* **First-class AI integration** (`AI()`, `Prob<T>`, `resolve()`)
* **Execution graph generation** , traces probabilistic value flow through a program
* **Zero-surprise semantics**
* **Interpreter-based runtime** written in JavaScript (Node.js)

---

## Features

### 1. First-Class AI Uncertainty

AI calls return `Prob<T>`, not a raw value. Explicit resolution is required:

```kova
let review = "Outstanding product quality!"

let probSentiment = AI("classify sentiment as positive, negative, or neutral", review)
let sentiment     = resolve(probSentiment)

if sentiment == "positive" {
    respond { status: 200, body: { approved: true } }
}
```

The semantic analyzer will reject any program that attempts to use a `Prob<T>` value without resolving it first.

### 2. Execution Graph

Every Kova program produces an execution graph at runtime, a directed node/edge structure tracing control flow, data dependencies, and where probabilistic values enter and get resolved.

```bash
kova run examples/pipeline.kova --graph
```

### 3. Clean Syntax

Kova uses English-like expressions that reduce boilerplate:

```kova
POST "/users" save { name: "Alice", role: "admin" } into result
```

### 4. First-Class HTTP Verbs

HTTP requests are native operations:

```kova
GET    "https://api.example.com/data" into result
POST   "https://api.example.com/items" save payload
PUT    "https://api.example.com/item/1" save updates
DELETE "https://api.example.com/item/1"
```

### 5. Database Operations

```kova
connect postgres using { host: ENV.DB_HOST, database: "app" } into db

find   users where { active: true } limit 10 into results
insert users { name: "Alice", role: "admin" }
update users set { verified: true } where { id: userId }
```

### 6. ENV Support

Kova supports environment variables via `ENV.KEY`:

```kova
connect mysql using {
    host:     ENV.DB_HOST,
    user:     ENV.DB_USER,
    password: ENV.DB_PASS,
    database: ENV.DB_NAME
}
```

### 7. Imports

```kova
import { handler, util } from "./routes/users"
import logger from "./lib/logger"
```

### 8. Complete Interpreter Pipeline

Kova ships with a full interpreter pipeline written in JavaScript:

* Lexer (tokenizer)
* Recursive-descent parser (AST generator)
* Semantic analyzer (type checker)
* Tree-walk interpreter
* Execution graph engine

---

## Project Structure

```
kova/
├── bin/
│   └── kova.js                  CLI entry point
├── src/
│   ├── index.js                 Public API , runKova(), runKovaSync(), parseKova()
│   ├── lexer/
│   │   └── lexer.js             Tokenizer
│   ├── parser/
│   │   └── parser.js            Recursive-descent parser
│   ├── semantic/
│   │   └── semanticAnalyzer.js  Type checker + Prob<T> enforcement
│   ├── interpreter/
│   │   └── interpreter.js       Async tree-walk interpreter
│   ├── graph/
│   │   └── executionGraph.js    Execution graph engine
│   ├── ai/
│   │   └── groq.js              Groq AI client + Prob<T> type implementation
│   └── core/
│       └── diagnostic.js        Error formatting
├── lib/
│   └── functions/
│   |    └── index.js            Built-in functions and type signatures
│   └── regex/
│   |    └── index.js            Regex expressions to match code values 
│   └── constants/
│       └── store.js             Keywords and symbols store
├── examples/
│   ├── sentiment.kova           Sentiment classification pipeline
│   ├── pipeline.kova            Multi-step AI pipeline with graph output
│   └── api.kova                 HTTP fetch + AI tagging + conditional POST
├── tests/
│   └── kova.test.js             117-test suite
└── README.md
```

---

## Core Concepts

### Tokens

The Kova lexer recognizes the following token categories:

#### Keywords

**Runtime**
* `let`, `fn`, `return`, `import`, `from`, `export`

**Control flow**
* `if`, `else`, `while`, `for`, `in`

**HTTP**
* `GET`, `POST`, `PUT`, `DELETE`, `PATCH`

**Database / Query**
* `find`, `insert`, `update`, `connect`, `using`
* `into`, `save`, `set`, `where`, `limit`, `order_by`, `asc`, `desc`

**AI**
* `AI`, `resolve` (built-in functions enforced by the semantic analyzer)
* `Prob<T>` , the probabilistic type produced by every `AI()` call

**Response**
* `respond`

**Literals**
* `true`, `false`, `null`

#### Other tokens
* Identifiers, numbers, strings
* Operators: `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `=`, `<`, `>`, `<=`, `>=`, `&&`, `||`, `!`
* Compound assignment: `+=`, `-=`, `*=`, `/=`
* Punctuation: `{`, `}`, `(`, `)`, `[`, `]`, `,`, `:`
* ENV access via `ENV.KEY`

### AST (Abstract Syntax Tree)

Kova's parser produces a typed AST. Every node carries a `type` field and source location for accurate error reporting.

### Interpreter Runtime

Kova uses an async tree-walk interpreter. It supports:

* Synchronous execution (`runKovaSync`) for testing and offline use
* Async execution (`runKova`) for real AI calls via Groq
* Automatic stub mode when no API key is present

### Prob\<T\> Type System

`AI()` always returns a `Prob<T>`. The semantic analyzer tracks this and enforces:

* `Prob<T>` cannot appear in binary expressions
* `Prob<T>` cannot be used as an `if` condition
* `Prob<T>` cannot be passed to functions expecting a concrete type
* `resolve()` is the only way to unwrap it

### Execution Graph

Every program run produces a directed graph with node kinds: `entry`, `exit`, `declare`, `assign`, `call`, `ai`, `resolve_prob`, `if`, `respond`, `http`, `db_connect`, and more. Edge kinds include `seq`, `control`, `data`, `call`, and `binding`. The graph can be visualized using the built-in D3-based HTML visualizer.

---

## AI Integration (Groq)

Kova uses [Groq](https://console.groq.com) as its AI backend , free tier, no credit card required.

```bash
echo "GROQ_API_KEY=your_key_here" > .env
```

Without a key, Kova runs in **stub mode**. `AI()` returns a placeholder value so programs can be developed and tested without API calls. All 117 tests run in stub mode.

**Structured output:**

```kova
let probData = AI("extract fields", document, { name: "string", date: "string" })
let data     = resolve(probData)
```

---

## Example Program

```kova
let name = "Kova"
let age  = 2 * 10

if age == 20 {
    POST "/log" save { name: name, age: age } into server
}

let probTag = AI("classify this program as serious or playful", name)
let tag     = resolve(probTag)

respond { status: 200, body: { tag: tag } }
```

---

## Building From Source

```bash
git clone https://github.com/kova-lang/kova.git
cd kova
npm install
npm link
```

**Requirements:** Node.js 18+

---

## Running Programs

```bash
kova run examples/sentiment.kova
kova run examples/pipeline.kova --graph
kova check examples/api.kova
kova help
```

---

## Testing

```bash
npm test
```

115 tests covering: variable declarations, arithmetic, comparison, logical operators, loops, functions, closures, arrays, objects, HTTP verbs, database operations, environment variables, imports, respond statements, real-world backend snippets, and the full `AI()` / `Prob<T>` / `resolve()` type system.

---

## Language Specification

Full spec is in `docs/language-spec.md`. Includes:

* Grammar rules
* Precedence table
* Runtime behavior
* Native operations
* Prob\<T\> type semantics

---

## Motivation

Kova started from a single question: if a program calls an AI model, where does uncertainty enter, and how does it flow? Most languages have no structural answer. Kova forces the question into the type system. The execution graph makes the answer visible.

The longer-term interest is in whether symbolic program structures like execution graphs can serve as interpretable scaffolding for probabilistic learning systems , a bridge between structured symbolic computation and adaptive AI models.

---

## License

MIT License.

---

## Contributing

Pull requests are welcome. Open an issue for feature requests or bug reports.

---

## Author

Samuel Ifedapo Oguntimehin
[github.com/Cybugg](https://github.com/Cybugg) · [linkedin.com/in/samuel-oguntimehin-1636331b3](https://www.linkedin.com/in/samuel-oguntimehin-1636331b3/)
