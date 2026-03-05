import { runKova, defaultExternals, defaultSignatures } from "../src/index.js";

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      → ${e.message}`); failed++; }
}
function assert(cond, msg = "Assertion failed") { if (!cond) throw new Error(msg); }
function assertThrows(fn, fragment) {
    let threw = false;
    try { fn(); } catch (e) {
        threw = true;
        if (fragment && !e.message.includes(fragment))
            throw new Error(`Expected error containing "${fragment}" but got: "${e.message}"`);
    }
    if (!threw) throw new Error("Expected an error but none was thrown");
}
function eq(a, b) { assert(a === b, `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ─── Variable Declaration ────────────────────────────────────────────────────
console.log("\n Variable Declaration");
test("number",           () => eq(runKova(`let x = 5  return x`).returnValue, 5));
test("string",           () => eq(runKova(`let x = "hi"  return x`).returnValue, "hi"));
test("boolean",          () => eq(runKova(`let x = true  return x`).returnValue, true));
test("null literal",     () => eq(runKova(`let x = null  return x`).returnValue, null));
test("float literal",    () => eq(runKova(`let x = 3.14  return x`).returnValue, 3.14));
test("expression init",  () => eq(runKova(`let x = 5  let y = x + 2  return y`).returnValue, 7));
test("undeclared throws",     () => assertThrows(() => runKova(`let y = x`), "Undeclar"));
test("duplicate throws",      () => assertThrows(() => runKova(`let x = 1  let x = 2`), "already declared"));

// ─── Arithmetic ──────────────────────────────────────────────────────────────
console.log("\n Arithmetic");
test("add",         () => eq(runKova(`return 3 + 4`).returnValue, 7));
test("sub",         () => eq(runKova(`return 10 - 3`).returnValue, 7));
test("mul",         () => eq(runKova(`return 3 * 4`).returnValue, 12));
test("div",         () => eq(runKova(`return 10 / 2`).returnValue, 5));
test("mod",         () => eq(runKova(`return 10 % 3`).returnValue, 1));
test("precedence",  () => eq(runKova(`return 2 + 3 * 4`).returnValue, 14));
test("parens",      () => eq(runKova(`return (2 + 3) * 4`).returnValue, 20));
test("float",       () => eq(runKova(`return 1.5 + 1.5`).returnValue, 3));
test("unary neg",   () => eq(runKova(`return -5`).returnValue, -5));
test("string concat", () => eq(runKova(`return "hello" + " world"`).returnValue, "hello world"));
test("div by zero throws", () => assertThrows(() => runKova(`return 10 / 0`), "Division by zero"));

// ─── Comparison / Logical ─────────────────────────────────────────────────────
console.log("\n Comparison & Logical");
test("gt",     () => eq(runKova(`return 5 > 3`).returnValue, true));
test("lt",     () => eq(runKova(`return 2 < 3`).returnValue, true));
test("gte",    () => eq(runKova(`return 3 >= 3`).returnValue, true));
test("eq num", () => eq(runKova(`return 3 == 3`).returnValue, true));
test("neq",    () => eq(runKova(`return 3 != 4`).returnValue, true));
test("AND",    () => eq(runKova(`return true && true`).returnValue, true));
test("OR",     () => eq(runKova(`return false || true`).returnValue, true));
test("NOT",    () => eq(runKova(`return !true`).returnValue, false));

// ─── While / For ─────────────────────────────────────────────────────────────
console.log("\n Loops");
test("while sum", () => eq(runKova(`let i = 0\nlet s = 0\nwhile i < 5 { s = s + i\n i = i + 1 }\nreturn s`).returnValue, 10));
test("for sum",   () => eq(runKova(`let arr = [1,2,3,4,5]\nlet s = 0\nfor x in arr { s = s + x }\nreturn s`).returnValue, 15));
test("for range", () => eq(runKova(`let s = 0\nfor x in range(0,5) { s += x }\nreturn s`).returnValue, 10));

// ─── Functions ───────────────────────────────────────────────────────────────
console.log("\n Functions");
test("basic fn",    () => eq(runKova(`fn add(a, b) { return a + b }\nreturn add(3, 4)`).returnValue, 7));
test("recursion",   () => eq(runKova(`fn fact(n) { if n <= 1 { return 1 }\nreturn n * fact(n - 1) }\nreturn fact(5)`).returnValue, 120));
test("closure",     () => eq(runKova(`let base = 10\nfn add(x) { return x + base }\nreturn add(5)`).returnValue, 15));

// ─── Arrays / Objects ────────────────────────────────────────────────────────
console.log("\n Arrays & Objects");
test("array literal",  () => { const r = runKova(`let a = [1,2,3]  return a`); eq(r.returnValue[1], 2); });
test("array index",    () => eq(runKova(`let a = [10,20,30]  return a[1]`).returnValue, 20));
test("array push",     () => { const r = runKova(`let a = [1,2]\na.push(3)\nreturn a[2]`); eq(r.returnValue, 3); });
test("object dot",     () => eq(runKova(`let o = { x: 42 }  return o.x`).returnValue, 42));
test("object bracket", () => eq(runKova(`let o = { x: 42 }  return o["x"]`).returnValue, 42));
test("nested object",  () => eq(runKova(`let o = { inner: { val: 7 } }  return o.inner.val`).returnValue, 7));
test("compound +=",    () => eq(runKova(`let x = 5\nx += 3\nreturn x`).returnValue, 8));
test("member +=",      () => eq(runKova(`let o = { x: 5 }\no.x += 10\nreturn o.x`).returnValue, 15));

// ─── HTTP – basic ─────────────────────────────────────────────────────────────
console.log("\n HTTP – Basic");
test("GET output",    () => assert(runKova(`GET "https://api.example.com"`).output.some(l => l.includes("GET"))));
test("POST output",   () => assert(runKova(`POST "https://api.example.com"`).output.some(l => l.includes("POST"))));
test("PUT output",    () => assert(runKova(`PUT "https://api.example.com"`).output.some(l => l.includes("PUT"))));
test("DELETE output", () => assert(runKova(`DELETE "https://api.example.com"`).output.some(l => l.includes("DELETE"))));
test("PATCH output",  () => assert(runKova(`PATCH "https://api.example.com"`).output.some(l => l.includes("PATCH"))));

// ─── HTTP – into binding ──────────────────────────────────────────────────────
console.log("\n HTTP – 'into' binding");
test("GET into result", () => {
    const r = runKova(`GET "https://api.example.com/users" into users\nreturn users.ok`);
    eq(r.returnValue, true);
});
test("GET into status", () => {
    const r = runKova(`GET "https://api.example.com/data" into res\nreturn res.status`);
    eq(r.returnValue, 200);
});
test("let res = GET ...", () => {
    const r = runKova(`let res = GET "https://api.example.com"\nreturn res.ok`);
    eq(r.returnValue, true);
});

// ─── HTTP – save body ─────────────────────────────────────────────────────────
console.log("\n HTTP – 'save' body");
test("POST save body", () => {
    const r = runKova(`
let userData = { name: "Alice", email: "alice@x.com" }
POST "/users" save userData into created
return created.ok`);
    eq(r.returnValue, true);
});
test("POST save into output", () => {
    const r = runKova(`
let data = { key: "value" }
POST "https://api.example.com/items" save data into res`);
    assert(r.output.some(l => l.includes("POST")));
    assert(r.output.some(l => l.includes("key")));
});
test("PUT save body", () => {
    const r = runKova(`
let updateData = { verified: true }
PUT "/users/1" save updateData into res
return res.status`);
    eq(r.returnValue, 200);
});

// ─── CONNECT ─────────────────────────────────────────────────────────────────
console.log("\n CONNECT");
test("connect mysql using object", () => {
    const r = runKova(`
connect mysql using {
    host: "localhost",
    user: "root",
    password: "secret",
    database: "mydb"
}`);
    assert(r.output.some(l => l.includes("[DB]") && l.includes("mysql")));
});
test("connect with into binding", () => {
    const r = runKova(`
connect postgres using { host: "localhost", database: "shop" } into db
return db.driver`);
    eq(r.returnValue, "postgres");
});
test("connect stores connection object", () => {
    const r = runKova(`
connect mysql using { host: "localhost", database: "app" }
return mysql.connected`);
    eq(r.returnValue, true);
});

// ─── ENV ─────────────────────────────────────────────────────────────────────
console.log("\n ENV");
test("ENV.NODE_ENV access", () => {
    process.env.NODE_ENV = "test";
    const r = runKova(`
connect mysql using {
    host: ENV.NODE_ENV,
    database: "app"
}`);
    assert(r.output.some(l => l.includes("test")));
});
test("ENV member in object literal", () => {
    process.env.TEST_VAR = "hello";
    const r = runKova(`let cfg = { val: ENV.TEST_VAR }  return cfg.val`);
    eq(r.returnValue, "hello");
});

// ─── FIND / INSERT / UPDATE ───────────────────────────────────────────────────
console.log("\n DB Queries");
test("find with where + into", () => {
    const r = runKova(`
find users where { active: true } into results
return results.collection`);
    eq(r.returnValue, "users");
});
test("find with limit", () => {
    const r = runKova(`
find products where { inStock: true } limit 10 into foundItems
return foundItems.limit`);
    eq(r.returnValue, 10);
});
test("find with order_by", () => {
    const r = runKova(`
find orders where { status: "pending" } order_by createdAt desc into orders
return orders.orderBy.direction`);
    eq(r.returnValue, "desc");
});
test("insert into collection", () => {
    const r = runKova(`
insert into users { name: "Alice", email: "alice@x.com" } into newUser
return newUser.collection`);
    eq(r.returnValue, "users");
});
test("insert returns insertedId", () => {
    const r = runKova(`
insert into products { name: "Widget" } into result
return result.insertedId`);
    assert(typeof r.returnValue === "string");
    assert(r.returnValue.startsWith("id_"));
});
test("update with set and where", () => {
    const r = runKova(`
update users set { verified: true } where { id: 1 } into updateResult
return updateResult.modifiedCount`);
    eq(r.returnValue, 1);
});
test("update output logged", () => {
    const r = runKova(`
update orders set { status: "shipped" } where { id: 99 }`);
    assert(r.output.some(l => l.includes("[DB]") && l.includes("update")));
});

// ─── RESPOND ─────────────────────────────────────────────────────────────────
console.log("\n RESPOND");
test("respond with object", () => {
    const r = runKova(`respond { status: 200, body: "OK" }`);
    assert(r.output.some(l => l.includes("[RESPOND]")));
    eq(r.respondValue.status, 200);
});
test("respond with variable", () => {
    const r = runKova(`
let data = { id: 1, name: "Alice" }
respond { status: 200, body: data }`);
    eq(r.respondValue.status, 200);
});
test("respond shorthand value", () => {
    const r = runKova(`respond "hello"`);
    eq(r.respondValue.body, "hello");
});

// ─── IMPORT ───────────────────────────────────────────────────────────────────
console.log("\n IMPORT");
test("named import parsed", () => {
    const r = runKova(`import { handler, util } from "./routes/users"`);
    assert(r.output.some(l => l.includes("[IMPORT]") && l.includes("handler")));
});
test("default import parsed", () => {
    const r = runKova(`import logger from "./lib/logger"`);
    assert(r.output.some(l => l.includes("[IMPORT]") && l.includes("logger")));
});

// ─── Real-world backend snippet ───────────────────────────────────────────────
console.log("\n Real-world Backend Snippets");

test("full user creation flow", () => {
    const r = runKova(`
let userData = { name: "Bob", email: "bob@example.com" }
POST "/api/users" save userData into createdUser
return createdUser.ok`);
    eq(r.returnValue, true);
});

test("connect + insert flow", () => {
    const r = runKova(`
connect mysql using { host: "localhost", database: "shop" }
insert into products { name: "Laptop", price: 999 } into product
return product.collection`);
    eq(r.returnValue, "products");
});

test("find + respond flow", () => {
    const r = runKova(`
find users where { active: true } limit 20 into users
respond { status: 200, body: users }`);
    eq(r.respondValue.status, 200);
    eq(r.output.filter(l => l.includes("[DB]")).length, 1);
});

test("HTTP fetch + conditional respond", () => {
    const r = runKova(`
GET "https://api.example.com/health" into healthCheck
if healthCheck.ok {
    respond { status: 200, body: "healthy" }
} else {
    respond { status: 503, body: "down" }
}`);
    eq(r.respondValue.status, 200);
});

test("update based on fetched data", () => {
    const r = runKova(`
let userId = 42
GET "https://auth.service.com/validate" into authResult
update users set { lastSeen: "now" } where { id: userId } into updateRes
return updateRes.modifiedCount`);
    eq(r.returnValue, 1);
});

// ─── Comments ─────────────────────────────────────────────────────────────────
console.log("\n Comments");
test("// comment",  () => eq(runKova(`// comment\nlet x = 5\nreturn x`).returnValue, 5));
test("# comment",   () => eq(runKova(`# comment\nlet x = 10\nreturn x`).returnValue, 10));
test("/* block */", () => eq(runKova(`/* block */\nlet x = 7\nreturn x`).returnValue, 7));

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(56)}`);
const total = passed + failed;
console.log(`  ${passed} passed, ${failed} failed out of ${total} tests (${((passed/total)*100).toFixed(1)}%)`);
console.log(`${"─".repeat(56)}\n`);
if (failed > 0) process.exit(1);
