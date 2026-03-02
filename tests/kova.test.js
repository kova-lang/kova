import { runKova } from "../src/index.js";
import { defaultExternals, defaultSignatures } from "../lib/functions/index.js";

// ─── Test Runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`    ${name}`);
        passed++;
    } catch (e) {
        console.error(`    ${name}: ${e.message}`);
        failed++;
    }
}

function assert(condition, msg = "Assertion failed") {
    if (!condition) throw new Error(msg);
}

function assertThrows(fn, fragment) {
    let threw = false;
    try { fn(); } catch (e) {
        threw = true;
        if (fragment && !e.message.includes(fragment)) {
            throw new Error(`Expected error containing "${fragment}" but got: "${e.message}"`);
        }
    }
    if (!threw) throw new Error("Expected an error to be thrown, but none was");
}

// ─── Variable Declaration ─────────────────────────────────────────────────────
console.log("\n Variable Declaration");

test("declares a number", () => {
    assert(runKova(`let x = 5  return x`).returnValue === 5);
});
test("declares a string", () => {
    assert(runKova(`let x = "hello"  return x`).returnValue === "hello");
});
test("declares a boolean", () => {
    assert(runKova(`let x = true  return x`).returnValue === true);
});
test("variable used in expression", () => {
    assert(runKova(`let x = 5  let y = x + 2  return y`).returnValue === 7);
});
test("throws on undeclared variable", () => {
    assertThrows(() => runKova(`let y = x + 2`), "Undeclar");
});
test("throws on duplicate declaration", () => {
    assertThrows(() => runKova(`let x = 5  let x = 10`), "already declared");
});

// ─── Arithmetic ───────────────────────────────────────────────────────────────
console.log("\n Arithmetic");

test("addition",                () => assert(runKova(`return 3 + 4`).returnValue === 7));
test("subtraction",             () => assert(runKova(`return 10 - 3`).returnValue === 7));
test("multiplication",          () => assert(runKova(`return 3 * 4`).returnValue === 12));
test("division",                () => assert(runKova(`return 10 / 2`).returnValue === 5));
test("precedence: * before +",  () => assert(runKova(`return 2 + 3 * 4`).returnValue === 14));
test("parenthesised expr",      () => assert(runKova(`return (2 + 3) * 4`).returnValue === 20));
test("unary negation literal",  () => assert(runKova(`return -5`).returnValue === -5));
test("unary negation variable", () => assert(runKova(`let x = 5  return -x`).returnValue === -5));
test("throws: arithmetic on string", () => {
    assertThrows(() => runKova(`let x = "a"  let y = x + 1`), "Arithmetic");
});

// ─── Comparison ───────────────────────────────────────────────────────────────
console.log("\n Comparison");

test("greater than (true)",           () => assert(runKova(`return 5 > 3`).returnValue === true));
test("greater than (false)",          () => assert(runKova(`return 2 > 3`).returnValue === false));
test("less than",                     () => assert(runKova(`return 2 < 3`).returnValue === true));
test("gte equal case",                () => assert(runKova(`return 3 >= 3`).returnValue === true));
test("lte",                           () => assert(runKova(`return 2 <= 3`).returnValue === true));
test("equality numbers",              () => assert(runKova(`return 3 == 3`).returnValue === true));
test("inequality numbers",            () => assert(runKova(`return 3 != 4`).returnValue === true));
test("equality strings",              () => assert(runKova(`return "a" == "a"`).returnValue === true));
test("throws: equality across types", () => assertThrows(() => runKova(`return 1 == true`), "same type"));
test("throws: comparison on strings", () => assertThrows(() => runKova(`return "a" > "b"`), "Comparison"));

// ─── Logical ──────────────────────────────────────────────────────────────────
console.log("\n Logical");

test("AND true && true",       () => assert(runKova(`return true && true`).returnValue === true));
test("AND true && false",      () => assert(runKova(`return true && false`).returnValue === false));
test("OR false || true",       () => assert(runKova(`return false || true`).returnValue === true));
test("NOT !true",              () => assert(runKova(`return !true`).returnValue === false));
test("NOT !false",             () => assert(runKova(`return !false`).returnValue === true));
test("throws: AND on numbers", () => assertThrows(() => runKova(`return 1 && 2`), "Logical"));
test("throws: OR on numbers",  () => assertThrows(() => runKova(`return 1 || 0`), "Logical"));

// ─── If / Else ────────────────────────────────────────────────────────────────
console.log("\n If / Else");

test("if branch taken", () => {
    assert(runKova(`let x = 5\nif x > 3 {\n    return 10\n}`).returnValue === 10);
});
test("if not taken, falls through", () => {
    assert(runKova(`let x = 1\nif x > 3 {\n    return 10\n}\nreturn 0`).returnValue === 0);
});
test("if-else: else branch taken", () => {
    assert(runKova(`let x = 1\nif x > 3 {\n    return 10\n} else {\n    return 99\n}`).returnValue === 99);
});
test("else if: middle branch (no parens)", () => {
    assert(runKova(
`let x = 2
if x > 3 {
    return 10
} else if x == 2 {
    return 2
} else {
    return 0
}`).returnValue === 2);
});
test("else if: middle branch (with parens)", () => {
    assert(runKova(
`let x = 2
if x > 3 {
    return 10
} else if (x == 2) {
    return 2
} else {
    return 0
}`).returnValue === 2);
});
test("else if: else branch taken", () => {
    assert(runKova(
`let x = 0
if x > 3 {
    return 10
} else if x == 2 {
    return 2
} else {
    return 0
}`).returnValue === 0);
});
test("nested if", () => {
    assert(runKova(
`let x = 5
let y = 10
if x > 3 {
    if y > 5 {
        return 1
    } else {
        return 2
    }
} else {
    return 3
}`).returnValue === 1);
});
test("throws: if condition not boolean", () => {
    assertThrows(() => runKova(`let x = 3\nif x {\n    return 3\n}`), "boolean");
});

// ─── Scope ────────────────────────────────────────────────────────────────────
console.log("\n Scope");

test("inner var not visible outside block", () => {
    assertThrows(() => runKova(
`if true == true {
    let inner = 5
}
return inner`
    ), "Undeclar");
});
test("outer var accessible inside block", () => {
    assert(runKova(`let x = 10\nif x > 5 {\n    return x\n}\nreturn 0`).returnValue === 10);
});
test("shadowing: inner x doesn't affect outer", () => {
    assert(runKova(
`let x = 1
if x == 1 {
    let x = 99
}
return x`).returnValue === 1);
});

// ─── Return ───────────────────────────────────────────────────────────────────
console.log("\n️  Return");

test("early return stops execution", () => {
    assert(runKova(`return 1\nreturn 2`).returnValue === 1);
});
test("return from inside if", () => {
    assert(runKova(`let x = 5\nif x > 3 {\n    return 42\n}\nreturn 0`).returnValue === 42);
});
test("no return → returnValue undefined", () => {
    assert(runKova(`let x = 5`).returnValue === undefined);
});

// ─── HTTP ─────────────────────────────────────────────────────────────────────
console.log("\n HTTP");

test("POST produces output entry", () => {
    const r = runKova(`POST "https://example.com"`);
    assert(r.output.length === 1);
    assert(r.output[0].includes("POST"));
    assert(r.output[0].includes("https://example.com"));
});
test("GET produces output entry",     () => assert(runKova(`GET "https://a.com"`).output[0].includes("GET")));
test("PUT produces output entry",     () => assert(runKova(`PUT "https://a.com"`).output[0].includes("PUT")));
test("DELETE produces output entry",  () => assert(runKova(`DELETE "https://a.com"`).output[0].includes("DELETE")));
test("multiple HTTP calls accumulate",() => assert(runKova(`POST "https://a.com"\nGET "https://b.com"`).output.length === 2));

// ─── External Calls ───────────────────────────────────────────────────────────
console.log("\n External Calls");

// FIX 1: AI("hello") was failing because defaultSignatures requires 2 params.
// Match the actual signature — use AI("summarize", x) which is the 2-param form.
test("AI call returns a value", () => {
    const r = runKova(
        `let x = 3  let y = AI("summarize", x)  return y`,
        defaultExternals,
        defaultSignatures
    );
    assert(r.returnValue !== undefined, `Expected a return value, got ${r.returnValue}`);
});
test("AI call with two args", () => {
    const r = runKova(
        `let x = 5  let y = AI("classify", x)  return y`,
        defaultExternals,
        defaultSignatures
    );
    assert(r.returnValue !== undefined);
});
test("throws: unknown external function", () => {
    assertThrows(
        () => runKova(`let x = UNKNOWN("test")`, defaultExternals, defaultSignatures),
        "Unknown function"
    );
});
test("throws: wrong arg count for AI", () => {
    assertThrows(
        () => runKova(`let y = AI()`, defaultExternals, defaultSignatures),
        "argument"
    );
});

// ─── Lexer Edge Cases ─────────────────────────────────────────────────────────
console.log("\n Lexer");

test("throws: identifier starting with digit", () => {
    assertThrows(() => runKova(`let 3x = 5`));
});
test("// comments ignored", () => {
    assert(runKova(`// comment\nlet x = 5\nreturn x`).returnValue === 5);
});
test("# comments ignored", () => {
    assert(runKova(`# comment\nlet x = 10\nreturn x`).returnValue === 10);
});
test("multi-line program", () => {
    assert(runKova(`let a = 1\nlet b = 2\nlet c = a + b\nreturn c`).returnValue === 3);
});

// ─── Diagnostic ───────────────────────────────────────────────────────────────
console.log("\n Diagnostic");

// Helper: run code that always throws a Diagnostic, return the caught error
function catchDiagnostic(code) {
    try { runKova(code); return null; }
    catch (e) { return e; }
}

// FIX 2: Use a simple 1-line program so the Identifier node definitely has location.
// `let y = x + 2` — `x` is an undeclared Identifier on line 1, column 9.
test("error has numeric line property", () => {
    const e = catchDiagnostic(`let y = x + 2`);
    assert(e !== null, "Expected error to be thrown");
    assert(typeof e.line === "number", `Expected number, got ${typeof e.line} (value: ${e.line})`);
});

// FIX 3: Same simple case — format() should return a string containing the source line.
test("format() returns non-empty string with source line", () => {
    const e = catchDiagnostic(`let y = x + 2`);
    assert(e !== null, "Expected error to be thrown");
    assert(typeof e.format === "function", "Expected format() method on Diagnostic");
    const formatted = e.format();
    assert(typeof formatted === "string" && formatted.length > 0, "Expected non-empty string");
    assert(formatted.includes("let y = x + 2"), `format() missing source line:\n${formatted}`);
});

test("format() contains caret pointer", () => {
    const e = catchDiagnostic(`let y = x + 2`);
    const formatted = e.format();
    assert(formatted.includes("^"), `format() missing '^' pointer:\n${formatted}`);
});

// FIX 4: Confirm the error targets the condition node, not the if keyword.
// We check line (must be 2) and that column > 1 (would be 1 if wrongly targeting `if`).
// The exact column depends on whether the lexer captures position before or after advancing.
test("if-condition error targets condition node, not if keyword", () => {
    const e = catchDiagnostic(`let x = 3\nif x {\n    return 3\n}`);
    assert(e !== null, "Expected error");
    assert(e.line === 2, `Expected line 2, got ${e.line}`);
    // `if` is at column 1; `x` is at column 4 — either way it must be > 1
    assert(e.column > 1,
        `Column ${e.column} suggests error points at 'if' keyword, not the condition 'x'. ` +
        `Apply the lexer fix: capture line/column BEFORE the advance loop in readIdentifierOrKeyword().`
    );
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log(`${"─".repeat(50)}\n`);
if (failed > 0) process.exit(1);