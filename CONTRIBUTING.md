# Contributing to Kova

Thanks for your interest in contributing. This document covers everything you need to get started: how the codebase is structured, how to run tests, how to add features, and the conventions the project follows.

---

## Getting Started

```bash
git clone https://github.com/Cybugg/kova.git
cd kova
npm install
chmod +x bin/kova.js
npm link
```

Verify everything works:

```bash
npm test
kova help
kova run examples/sentiment.kova
```

All 117 tests should pass. The sentiment example should run in stub mode without a Groq key.

---

## Project Structure

```
kova/
├── bin/kova.js                  CLI entry point
├── src/
│   ├── index.js                 Public API: runKova, runKovaSync, parseKova
│   ├── lexer/lexer.js           Tokenizer
│   ├── parser/parser.js         Recursive-descent parser
│   ├── semantic/
│   │   └── semanticAnalyzer.js  Type checker and Prob<T> enforcement
│   ├── interpreter/
│   │   └── interpreter.js       Async tree-walk interpreter
│   ├── graph/
│   │   └── executionGraph.js    Execution graph engine
│   ├── ai/
│   │   └── groq.js              Groq client and Prob<T> runtime
│   └── core/
│       └── diagnostic.js        Error formatting
├── lib/
│   ├── constants/store.js       Keywords, operators, punctuation
│   ├── functions/index.js       Built-in function signatures
│   └── regex/index.js           Character class regexes
├── examples/                    Sample .kova programs
└── tests/kova.test.js           Test suite
```

---

## Running Tests

```bash
npm test
```

Tests use `runKovaSync` throughout so no Groq key is needed. All tests run offline.

To run a single section of the suite, search by the console.log label:

```bash
node tests/kova.test.js 2>&1 | grep -A 20 "Loops"
```

---

## Adding a Built-in Function

Built-in functions live in two places. Both must be updated together.

**1. Add the runtime implementation in `src/interpreter/interpreter.js`**

Inside the `_builtins` object in the constructor:

```javascript
repeat: (str, n) => String(str).repeat(n),
```

**2. Add the type signature in `lib/functions/index.js`**

Inside `defaultSignatures`:

```javascript
repeat: { params: ["string", "number"], returns: "string" },
```

**3. Write tests in `tests/kova.test.js`**

Under an appropriate section heading:

```javascript
test("repeat string", () => {
    const r = runKovaSync(`return repeat("ha", 3)`);
    eq(r.returnValue, "hahaha");
});
```

---

## Adding a Keyword

Keywords are defined in `lib/constants/store.js`. Adding one requires changes across the full pipeline.

**1. Add to the keyword map in `lib/constants/store.js`**

```javascript
break: "BREAK",
```

**2. Add a parsing function in `src/parser/parser.js`**

Add a case to `parseStatement()` and write the corresponding parse function.

**3. Handle the AST node in `src/semantic/semanticAnalyzer.js`**

Add a case to the `visit()` switch for the new node type.

**4. Handle it in `src/interpreter/interpreter.js`**

Add cases to both `visit()` and `_visitSync()`.

**5. Handle it in `src/graph/executionGraph.js`**

Add a case in the graph builder's `_buildNode()` method.

**6. Write tests.**

---

## Adding an Example Program

Example programs go in `examples/`. They should:

- Have a comment at the top explaining what they demonstrate
- Use `AI()` and `resolve()` at least once
- Work in stub mode without a Groq key
- Run cleanly with `kova run examples/yourfile.kova`

---

## Fixing a Bug

Before opening a pull request:

1. Write a test that reproduces the bug and fails
2. Fix the bug
3. Confirm the test now passes
4. Confirm all 117 existing tests still pass

---

## Commit Style

Each commit should do one clear thing. The message should say what changed and why, not just what file was touched.

```
# Good
add try-catch syntax to parser and interpreter
fix AI.returns type in lib/functions causing prob comparison error
add 6 tests for nested object member assignment

# Avoid
fix stuff
update files
wip
```

---

## Code Style

The codebase uses a consistent comment style. Match it when adding new code:

```javascript
// #### Section heading ####

// single line note

/*
   Multi-line explanation
   when needed
*/
```

No semicolons are required. The existing code omits them consistently.

Aligned colons in object literals and function signatures:

```javascript
export const defaultSignatures = {
    trim:    { params: ["string"],          returns: "string" },
    upper:   { params: ["string"],          returns: "string" },
    lower:   { params: ["string"],          returns: "string" },
};
```

---

## Questions

Open an issue on GitHub. Label it clearly: `bug`, `feature`, or `question`.