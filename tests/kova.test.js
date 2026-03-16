import { runKovaSync, runKova, defaultExternals, defaultSignatures } from "../src/index.js";

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      → ${e.message}`); failed++; }
}
async function testAsync(name, fn) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
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
async function assertThrowsAsync(fn, fragment) {
    let threw = false;
    try { await fn(); } catch (e) {
        threw = true;
        if (fragment && !e.message.includes(fragment))
            throw new Error(`Expected error containing "${fragment}" but got: "${e.message}"`);
    }
    if (!threw) throw new Error("Expected an error but none was thrown");
}
function eq(a, b) { assert(a === b, `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }


// #### Variable Declaration ####
console.log("\n Variable Declaration");
test("number",           () => eq(runKovaSync(`let x = 5  return x`).returnValue, 5));
test("string",           () => eq(runKovaSync(`let x = "hi"  return x`).returnValue, "hi"));
test("boolean",          () => eq(runKovaSync(`let x = true  return x`).returnValue, true));
test("null literal",     () => eq(runKovaSync(`let x = null  return x`).returnValue, null));
test("float literal",    () => eq(runKovaSync(`let x = 3.14  return x`).returnValue, 3.14));
test("expression init",  () => eq(runKovaSync(`let x = 5  let y = x + 2  return y`).returnValue, 7));
test("undeclared throws",  () => assertThrows(() => runKovaSync(`let y = x`), "Undeclar"));
test("duplicate throws",   () => assertThrows(() => runKovaSync(`let x = 1  let x = 2`), "already declared"));


// #### Arithmetic ####
console.log("\n Arithmetic");
test("add",              () => eq(runKovaSync(`return 3 + 4`).returnValue, 7));
test("sub",              () => eq(runKovaSync(`return 10 - 3`).returnValue, 7));
test("mul",              () => eq(runKovaSync(`return 3 * 4`).returnValue, 12));
test("div",              () => eq(runKovaSync(`return 10 / 2`).returnValue, 5));
test("mod",              () => eq(runKovaSync(`return 10 % 3`).returnValue, 1));
test("precedence",       () => eq(runKovaSync(`return 2 + 3 * 4`).returnValue, 14));
test("parens",           () => eq(runKovaSync(`return (2 + 3) * 4`).returnValue, 20));
test("float",            () => eq(runKovaSync(`return 1.5 + 1.5`).returnValue, 3));
test("unary neg",        () => eq(runKovaSync(`return -5`).returnValue, -5));
test("string concat",    () => eq(runKovaSync(`return "hello" + " world"`).returnValue, "hello world"));
test("div by zero throws", () => assertThrows(() => runKovaSync(`return 10 / 0`), "Division by zero"));


// #### Comparison & Logical ####
console.log("\n Comparison & Logical");
test("gt",     () => eq(runKovaSync(`return 5 > 3`).returnValue, true));
test("lt",     () => eq(runKovaSync(`return 2 < 3`).returnValue, true));
test("gte",    () => eq(runKovaSync(`return 3 >= 3`).returnValue, true));
test("eq num", () => eq(runKovaSync(`return 3 == 3`).returnValue, true));
test("neq",    () => eq(runKovaSync(`return 3 != 4`).returnValue, true));
test("AND",    () => eq(runKovaSync(`return true && true`).returnValue, true));
test("OR",     () => eq(runKovaSync(`return false || true`).returnValue, true));
test("NOT",    () => eq(runKovaSync(`return !true`).returnValue, false));


// #### Loops ####
console.log("\n Loops");
test("while sum", () => eq(runKovaSync(`let i = 0\nlet s = 0\nwhile i < 5 { s = s + i\n i = i + 1 }\nreturn s`).returnValue, 10));
test("for sum",   () => eq(runKovaSync(`let arr = [1,2,3,4,5]\nlet s = 0\nfor x in arr { s = s + x }\nreturn s`).returnValue, 15));
test("for range", () => eq(runKovaSync(`let s = 0\nfor x in range(0,5) { s += x }\nreturn s`).returnValue, 10));


// #### Functions ####
console.log("\n Functions");
test("basic fn",  () => eq(runKovaSync(`fn add(a, b) { return a + b }\nreturn add(3, 4)`).returnValue, 7));
test("recursion", () => eq(runKovaSync(`fn fact(n) { if n <= 1 { return 1 }\nreturn n * fact(n - 1) }\nreturn fact(5)`).returnValue, 120));
test("closure",   () => eq(runKovaSync(`let base = 10\nfn add(x) { return x + base }\nreturn add(5)`).returnValue, 15));


// #### Arrays & Objects ####
console.log("\n Arrays & Objects");
test("array literal",  () => { const r = runKovaSync(`let a = [1,2,3]  return a`); eq(r.returnValue[1], 2); });
test("array index",    () => eq(runKovaSync(`let a = [10,20,30]  return a[1]`).returnValue, 20));
test("array push",     () => { const r = runKovaSync(`let a = [1,2]\na.push(3)\nreturn a[2]`); eq(r.returnValue, 3); });
test("object dot",     () => eq(runKovaSync(`let o = { x: 42 }  return o.x`).returnValue, 42));
test("object bracket", () => eq(runKovaSync(`let o = { x: 42 }  return o["x"]`).returnValue, 42));
test("nested object",  () => eq(runKovaSync(`let o = { inner: { val: 7 } }  return o.inner.val`).returnValue, 7));
test("compound +=",    () => eq(runKovaSync(`let x = 5\nx += 3\nreturn x`).returnValue, 8));
test("member +=",      () => eq(runKovaSync(`let o = { x: 5 }\no.x += 10\nreturn o.x`).returnValue, 15));


// #### HTTP – Basic ####
console.log("\n HTTP – Basic");
test("GET output",    () => assert(runKovaSync(`GET "https://api.example.com"`).output.some(l => l.includes("GET"))));
test("POST output",   () => assert(runKovaSync(`POST "https://api.example.com"`).output.some(l => l.includes("POST"))));
test("PUT output",    () => assert(runKovaSync(`PUT "https://api.example.com"`).output.some(l => l.includes("PUT"))));
test("DELETE output", () => assert(runKovaSync(`DELETE "https://api.example.com"`).output.some(l => l.includes("DELETE"))));
test("PATCH output",  () => assert(runKovaSync(`PATCH "https://api.example.com"`).output.some(l => l.includes("PATCH"))));


// #### HTTP – 'into' binding ####
console.log("\n HTTP – 'into' binding");
test("GET into result", () => {
    const r = runKovaSync(`GET "https://api.example.com/users" into users\nreturn users.ok`);
    eq(r.returnValue, true);
});
test("GET into status", () => {
    const r = runKovaSync(`GET "https://api.example.com/data" into res\nreturn res.status`);
    eq(r.returnValue, 200);
});
test("let res = GET ...", () => {
    const r = runKovaSync(`let res = GET "https://api.example.com"\nreturn res.ok`);
    eq(r.returnValue, true);
});


// #### HTTP – 'save' body ####
console.log("\n HTTP – 'save' body");
test("POST save body", () => {
    const r = runKovaSync(`
let userData = { name: "Alice", email: "alice@x.com" }
POST "/users" save userData into created
return created.ok`);
    eq(r.returnValue, true);
});
test("POST save into output", () => {
    const r = runKovaSync(`
let data = { key: "value" }
POST "https://api.example.com/items" save data into res`);
    assert(r.output.some(l => l.includes("POST")));
});
test("PUT save body", () => {
    const r = runKovaSync(`
let updateData = { verified: true }
PUT "/users/1" save updateData into res
return res.status`);
    eq(r.returnValue, 200);
});


// #### CONNECT ####
console.log("\n CONNECT");
test("connect mysql using object", () => {
    const r = runKovaSync(`
connect mysql using {
    host: "localhost",
    user: "root",
    password: "secret",
    database: "mydb"
}`);
    assert(r.output.some(l => l.includes("[DB]") && l.includes("mysql")));
});
test("connect with into binding", () => {
    const r = runKovaSync(`
connect postgres using { host: "localhost", database: "shop" } into db
return db.driver`);
    eq(r.returnValue, "postgres");
});
test("connect stores connection object", () => {
    const r = runKovaSync(`
connect mysql using { host: "localhost", database: "app" }
return mysql.connected`);
    eq(r.returnValue, true);
});


// #### ENV ####
console.log("\n ENV");
test("ENV.NODE_ENV access", () => {
    process.env.NODE_ENV = "test";
    const r = runKovaSync(`
connect mysql using {
    host: ENV.NODE_ENV,
    database: "app"
}`);
    assert(r.output.some(l => l.includes("[DB]")));
});
test("ENV member in object literal", () => {
    process.env.TEST_VAR = "hello";
    const r = runKovaSync(`let cfg = { val: ENV.TEST_VAR }  return cfg.val`);
    eq(r.returnValue, "hello");
});


// #### DB Queries ####
console.log("\n DB Queries");
test("find with where + into", () => {
    const r = runKovaSync(`
find users where { active: true } into results
return results.collection`);
    eq(r.returnValue, "users");
});
test("find with limit", () => {
    const r = runKovaSync(`
find products where { inStock: true } limit 10 into foundItems
return foundItems.limit`);
    eq(r.returnValue, 10);
});
test("find with order_by", () => {
    const r = runKovaSync(`
find orders where { status: "pending" } order_by createdAt desc into foundOrders
return foundOrders.orderBy.direction`);
    eq(r.returnValue, "desc");
});
test("insert into collection", () => {
    const r = runKovaSync(`
insert into users { name: "Alice", email: "alice@x.com" } into newUser
return newUser.collection`);
    eq(r.returnValue, "users");
});
test("insert returns insertedId", () => {
    const r = runKovaSync(`
insert into products { name: "Widget" } into result
return result.insertedId`);
    assert(typeof r.returnValue === "string");
    assert(r.returnValue.startsWith("id_"));
});
test("update with set and where", () => {
    const r = runKovaSync(`
update users set { verified: true } where { id: 1 } into updateResult
return updateResult.modifiedCount`);
    eq(r.returnValue, 1);
});
test("update output logged", () => {
    const r = runKovaSync(`
update orders set { status: "shipped" } where { id: 99 }`);
    assert(r.output.some(l => l.includes("[DB]") && l.includes("update")));
});


// #### RESPOND ####
console.log("\n RESPOND");
test("respond with object", () => {
    const r = runKovaSync(`respond { status: 200, body: "OK" }`);
    assert(r.output.some(l => l.includes("[RESPOND]")));
    eq(r.respondValue.status, 200);
});
test("respond with variable", () => {
    const r = runKovaSync(`
let data = { id: 1, name: "Alice" }
respond { status: 200, body: data }`);
    eq(r.respondValue.status, 200);
});
test("respond shorthand value", () => {
    const r = runKovaSync(`respond "hello"`);
    eq(r.respondValue.body, "hello");
});


// #### IMPORT ####
console.log("\n IMPORT");
test("named import parsed", () => {
    const r = runKovaSync(`import { handler, util } from "./routes/users"\nreturn true`);
    eq(r.returnValue, true);
});
test("default import parsed", () => {
    const r = runKovaSync(`import logger from "./lib/logger"\nreturn true`);
    eq(r.returnValue, true);
});


// #### Real-world Backend Snippets ####
console.log("\n Real-world Backend Snippets");
test("full user creation flow", () => {
    const r = runKovaSync(`
let userData = { name: "Bob", email: "bob@example.com" }
POST "/api/users" save userData into createdUser
return createdUser.ok`);
    eq(r.returnValue, true);
});
test("connect + insert flow", () => {
    const r = runKovaSync(`
connect mysql using { host: "localhost", database: "shop" }
insert into products { name: "Laptop", price: 999 } into product
return product.collection`);
    eq(r.returnValue, "products");
});
test("find + respond flow", () => {
    const r = runKovaSync(`
find users where { active: true } limit 20 into users
respond { status: 200, body: users }`);
    eq(r.respondValue.status, 200);
    eq(r.output.filter(l => l.includes("[DB]")).length, 1);
});
test("HTTP fetch + conditional respond", () => {
    const r = runKovaSync(`
GET "https://api.example.com/health" into healthCheck
if healthCheck.ok {
    respond { status: 200, body: "healthy" }
} else {
    respond { status: 503, body: "down" }
}`);
    eq(r.respondValue.status, 200);
});
test("update based on fetched data", () => {
    const r = runKovaSync(`
let userId = 42
GET "https://auth.service.com/validate" into authResult
update users set { lastSeen: "now" } where { id: userId } into updateRes
return updateRes.modifiedCount`);
    eq(r.returnValue, 1);
});


// #### Comments ####
console.log("\n Comments");
test("// comment",  () => eq(runKovaSync(`// comment\nlet x = 5\nreturn x`).returnValue, 5));
test("# comment",   () => eq(runKovaSync(`# comment\nlet x = 10\nreturn x`).returnValue, 10));
test("/* block */", () => eq(runKovaSync(`/* block */\nlet x = 7\nreturn x`).returnValue, 7));


// #### AI Integration (Prob<T>) — Sync ####
console.log("\n AI Integration (Prob<T>) — Sync");
test("AI() returns a Prob value", () => {
    const r = runKovaSync(`let result = AI("classify", "hello world")\nreturn result`);
    const v  = r.returnValue;
    assert(v && v.__prob__ === true, "Expected Prob object");
    assert(v.task === "classify",    "Expected task to be set");
});
test("AI() Prob has value field", () => {
    const r = runKovaSync(`let result = AI("summarize", "some long text")\nreturn result`);
    assert(r.returnValue.value !== undefined, "Prob.value should exist");
});
test("AI() Prob has confidence field", () => {
    const r = runKovaSync(`let result = AI("classify", "text")\nreturn result`);
    assert(typeof r.returnValue.confidence === "number", "confidence should be number");
});
test("AI() Prob has model field", () => {
    const r = runKovaSync(`let result = AI("classify", "text")\nreturn result`);
    assert(typeof r.returnValue.model === "string", "model should be string");
});
test("resolve() unwraps Prob to value", () => {
    const r = runKovaSync(`
let prob = AI("classify", "hello")
let value = resolve(prob)
return value`);
    assert(typeof r.returnValue === "string", "resolved value should be string");
});
test("resolve() on non-Prob throws", () => {
    assertThrows(() => runKovaSync(`let x = 5\nlet y = resolve(x)`), "resolve()");
});
test("typeOf Prob returns 'prob'", () => {
    const r = runKovaSync(`let p = AI("tag", "news")\nreturn typeOf(p)`);
    eq(r.returnValue, "prob");
});
test("typeOf resolved value returns 'string'", () => {
    const r = runKovaSync(`let p = AI("classify", "text")\nlet v = resolve(p)\nreturn typeOf(v)`);
    eq(r.returnValue, "string");
});
test("AI result can be used in if after resolve", () => {
    const r = runKovaSync(`
let prob = AI("classify sentiment", "I love this")
let sentiment = resolve(prob)
let isPositive = sentiment.includes("[AI")
return isPositive`);
    assert(typeof r.returnValue === "boolean", "Should return boolean");
});
test("AI pipeline: classify then branch", () => {
    const r = runKovaSync(`
let review = "great product"
let probLabel = AI("classify", review)
let label = resolve(probLabel)
if label.includes("[AI") { return "classified" }
return "unclassified"`);
    eq(r.returnValue, "classified");
});
test("print shows Prob type info", () => {
    const r = runKovaSync(`
let p = AI("summarize", "some text")
print(p)`);
    assert(r.output.some(l => l.includes("Prob<")), "print should show Prob<> wrapper");
});


// #### Execution Graph ####
console.log("\n Execution Graph");
test("graph is returned from runKovaSync", () => {
    const r = runKovaSync(`let x = 5  return x`);
    assert(r.graph != null,      "Expected graph in result");
    assert(r.graph.json != null, "Expected graph.json");
});
test("graph has entry and exit nodes", () => {
    const r     = runKovaSync(`let x = 5`);
    const kinds = r.graph.json.nodes.map(n => n.kind);
    assert(kinds.includes("entry"), "No entry node");
    assert(kinds.includes("exit"),  "No exit node");
});
test("variable declaration produces declare node", () => {
    const r        = runKovaSync(`let name = "Alice"`);
    const declNode = r.graph.json.nodes.find(n => n.kind === "declare");
    assert(declNode != null,               "No declare node found");
    assert(declNode.label.includes("name"), `Expected label to include 'name', got: ${declNode.label}`);
});
test("HTTP statement produces http node", () => {
    const r = runKovaSync(`GET "https://api.example.com"`);
    assert(r.graph.json.nodes.some(n => n.kind === "http"), "No http node");
});
test("HTTP into binding captured in node meta", () => {
    const r        = runKovaSync(`GET "https://api.example.com/users" into users`);
    const httpNode = r.graph.json.nodes.find(n => n.kind === "http");
    assert(httpNode?.meta?.binding === "users", `Expected binding='users', got: ${httpNode?.meta?.binding}`);
});
test("data dependency edge created for variable reference", () => {
    const r = runKovaSync(`let x = 5\nlet y = x + 1`);
    assert(r.graph.json.edges.some(e => e.kind === "data" && e.label === "x"), "No data edge for x");
});
test("if statement produces if node with control edges", () => {
    const r = runKovaSync(`let x = 5\nif x > 3 { return 1 } else { return 0 }`);
    assert(r.graph.json.nodes.some(n => n.kind === "if"),                            "No if node");
    assert(r.graph.json.edges.some(e => e.kind === "control" && e.label === "true"), "No control-true edge");
    assert(r.graph.json.edges.some(e => e.kind === "control" && e.label === "false"),"No control-false edge");
});
test("function declaration produces fn_def node", () => {
    const r = runKovaSync(`fn add(a, b) { return a + b }`);
    assert(r.graph.json.nodes.some(n => n.kind === "fn_def" && n.label.includes("add")), "No fn_def node for add");
});
test("DB connect produces db_connect node", () => {
    const r = runKovaSync(`connect mysql using { host: "localhost", database: "app" }`);
    assert(r.graph.json.nodes.some(n => n.kind === "db_connect"), "No db_connect node");
});
test("find statement produces db_find node", () => {
    const r = runKovaSync(`find users where { active: true } into results`);
    assert(r.graph.json.nodes.some(n => n.kind === "db_find"), "No db_find node");
});
test("insert produces db_insert node", () => {
    const r = runKovaSync(`insert into users { name: "Alice" } into doc`);
    assert(r.graph.json.nodes.some(n => n.kind === "db_insert"), "No db_insert node");
});
test("respond produces respond node", () => {
    const r = runKovaSync(`respond { status: 200, body: "ok" }`);
    assert(r.graph.json.nodes.some(n => n.kind === "respond"), "No respond node");
});
test("topological order includes all nodes", () => {
    const r       = runKovaSync(`let x = 5\nlet y = x + 1\nreturn y`);
    const topoLen = r.graph.topologicalOrder.length;
    const nodeLen = r.graph.json.nodes.length;
    assert(topoLen > 0,          "Topological order is empty");
    assert(topoLen <= nodeLen,   `Topo order (${topoLen}) exceeds node count (${nodeLen})`);
});
test("source nodes exist and exclude entry/exit", () => {
    const r       = runKovaSync(`let x = 5\nlet y = 10`);
    const sources = r.graph.sourceNodes;
    assert(Array.isArray(sources),                                          "sourceNodes not an array");
    assert(sources.every(n => !["entry","exit"].includes(n.kind)),          "Source nodes include entry/exit");
});
test("while loop produces while node", () => {
    const r = runKovaSync(`let i = 0\nwhile i < 5 { i += 1 }`);
    assert(r.graph.json.nodes.some(n => n.kind === "while"), "No while node");
});
test("for loop produces for node", () => {
    const r = runKovaSync(`let arr = [1,2,3]\nfor x in arr { print(x) }`);
    assert(r.graph.json.nodes.some(n => n.kind === "for"), "No for node");
});
test("import produces import node", () => {
    const r = runKovaSync(`import { handler } from "./routes"`);
    assert(r.graph.json.nodes.some(n => n.kind === "import"), "No import node");
});
test("complex program graph has multiple node kinds", () => {
    const r     = runKovaSync(`
connect mysql using { host: "localhost", database: "shop" }
find users where { active: true } limit 10 into users
POST "https://api.example.com/log" save { count: 10 }
respond { status: 200, body: users }`);
    const kinds = new Set(r.graph.json.nodes.map(n => n.kind));
    assert(kinds.has("db_connect"), "Missing db_connect");
    assert(kinds.has("db_find"),    "Missing db_find");
    assert(kinds.has("http"),       "Missing http");
    assert(kinds.has("respond"),    "Missing respond");
});


// #### Sync Results ####
console.log(`\n${"####".repeat(56)}`);
const syncTotal = passed + failed;
console.log(`  ${passed} passed, ${failed} failed out of ${syncTotal} tests (${((passed/syncTotal)*100).toFixed(1)}%)`);
console.log(`${"####".repeat(56)}\n`);


// #### AI Integration (Prob<T>) — Async ####
console.log("\n AI Integration (Prob<T>) — Async");
await testAsync("runKova returns a result", async () => {
    const r = await runKova(`let x = 5  return x`);
    eq(r.returnValue, 5);
});
await testAsync("runKova AI() returns Prob in stub mode", async () => {
    const r = await runKova(`let p = AI("classify", "hello")\nreturn p`, {}, {}, { aiMode: "stub" });
    assert(r.returnValue.__prob__ === true, "Expected Prob object");
});
await testAsync("runKova resolve() unwraps Prob", async () => {
    const r = await runKova(`
let p = AI("classify", "hello")
let v = resolve(p)
return v`, {}, {}, { aiMode: "stub" });
    assert(typeof r.returnValue === "string", "resolved value should be string");
});
await testAsync("runKova AI pipeline resolves and branches", async () => {
    const r = await runKova(`
let review = "great product"
let probLabel = AI("classify", review)
let label = resolve(probLabel)
if label.includes("[AI") { return "classified" }
return "unclassified"`, {}, {}, { aiMode: "stub" });
    eq(r.returnValue, "classified");
});
await testAsync("runKova graph is returned", async () => {
    const r = await runKova(`let x = 5  return x`, {}, {}, { aiMode: "stub" });
    assert(r.graph != null,      "Expected graph in result");
    assert(r.graph.json != null, "Expected graph.json");
});
await testAsync("runKova graph has ai node for AI() call", async () => {
    const r = await runKova(`
let p = AI("classify", "hello")
let v = resolve(p)
return v`, {}, {}, { aiMode: "stub" });
    assert(r.graph.json.nodes.some(n => n.kind === "ai"),           "No ai node in graph");
    assert(r.graph.json.nodes.some(n => n.kind === "resolve_prob"), "No resolve_prob node in graph");
});
await testAsync("runKova error thrown for undeclared variable", async () => {
    await assertThrowsAsync(() => runKova(`let y = x`), "Undeclar");
});
await testAsync("runKova respond value returned", async () => {
    const r = await runKova(`respond { status: 200, body: "ok" }`, {}, {}, { aiMode: "stub" });
    eq(r.respondValue.status, 200);
});
await testAsync("runKova full backend flow with stub AI", async () => {
    const r = await runKova(`
connect mysql using { host: "localhost", database: "app" }
find users where { active: true } limit 10 into users
let probTag = AI("tag users", users)
let tag = resolve(probTag)
respond { status: 200, body: { tag: tag, count: 10 } }`, {}, {}, { aiMode: "stub" });
    eq(r.respondValue.status, 200);
    assert(r.graph.json.nodes.some(n => n.kind === "ai"),           "No ai node");
    assert(r.graph.json.nodes.some(n => n.kind === "resolve_prob"), "No resolve_prob node");
});


// #### Final Results ####
console.log(`\n${"####".repeat(56)}`);
const total = passed + failed;
console.log(`  ${passed} passed, ${failed} failed out of ${total} tests (${((passed/total)*100).toFixed(1)}%)`);
console.log(`${"####".repeat(56)}\n`);
if (failed > 0) process.exit(1);