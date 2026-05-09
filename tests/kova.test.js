import { runKovaSync, runKova, defaultExternals, defaultSignatures } from "../src/index.js";
import { resolve } from "path";

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
test("number", () => eq(runKovaSync(`let x = 5  return x`).returnValue, 5));
test("string", () => eq(runKovaSync(`let x = "hi"  return x`).returnValue, "hi"));
test("boolean", () => eq(runKovaSync(`let x = true  return x`).returnValue, true));
test("null literal", () => eq(runKovaSync(`let x = null  return x`).returnValue, null));
test("float literal", () => eq(runKovaSync(`let x = 3.14  return x`).returnValue, 3.14));
test("expression init", () => eq(runKovaSync(`let x = 5  let y = x + 2  return y`).returnValue, 7));
test("undeclared throws", () => assertThrows(() => runKovaSync(`let y = x`), "Undeclar"));
test("duplicate throws", () => assertThrows(() => runKovaSync(`let x = 1  let x = 2`), "already declared"));


// #### Arithmetic ####
console.log("\n Arithmetic");
test("add", () => eq(runKovaSync(`return 3 + 4`).returnValue, 7));
test("sub", () => eq(runKovaSync(`return 10 - 3`).returnValue, 7));
test("mul", () => eq(runKovaSync(`return 3 * 4`).returnValue, 12));
test("div", () => eq(runKovaSync(`return 10 / 2`).returnValue, 5));
test("mod", () => eq(runKovaSync(`return 10 % 3`).returnValue, 1));
test("precedence", () => eq(runKovaSync(`return 2 + 3 * 4`).returnValue, 14));
test("parens", () => eq(runKovaSync(`return (2 + 3) * 4`).returnValue, 20));
test("float", () => eq(runKovaSync(`return 1.5 + 1.5`).returnValue, 3));
test("unary neg", () => eq(runKovaSync(`return -5`).returnValue, -5));
test("string concat", () => eq(runKovaSync(`return "hello" + " world"`).returnValue, "hello world"));
test("div by zero throws", () => assertThrows(() => runKovaSync(`return 10 / 0`), "Division by zero"));
test("exp", () => eq(runKovaSync(`return 2**2`).returnValue, 4));
// #### Comparison & Logical ####
console.log("\n Comparison & Logical");
test("gt", () => eq(runKovaSync(`return 5 > 3`).returnValue, true));
test("lt", () => eq(runKovaSync(`return 2 < 3`).returnValue, true));
test("gte", () => eq(runKovaSync(`return 3 >= 3`).returnValue, true));
test("eq num", () => eq(runKovaSync(`return 3 == 3`).returnValue, true));
test("neq", () => eq(runKovaSync(`return 3 != 4`).returnValue, true));
test("AND", () => eq(runKovaSync(`return true && true`).returnValue, true));
test("OR", () => eq(runKovaSync(`return false || true`).returnValue, true));
test("NOT", () => eq(runKovaSync(`return !true`).returnValue, false));


// #### Loops ####
console.log("\n Loops");
test("while sum", () => eq(runKovaSync(`let i = 0\nlet s = 0\nwhile i < 5 { s = s + i\n i = i + 1 }\nreturn s`).returnValue, 10));
test("for sum", () => eq(runKovaSync(`let arr = [1,2,3,4,5]\nlet s = 0\nfor x in arr { s = s + x }\nreturn s`).returnValue, 15));
test("for range", () => eq(runKovaSync(`let s = 0\nfor x in range(0,5) { s += x }\nreturn s`).returnValue, 10));


// #### Control Flow / If-Else ####
console.log("\n Control Flow / If-Else");
test("if else basic", () => eq(runKovaSync(`let x = 5\nif x > 3 { return 1 } else { return 0 }`).returnValue, 1));
test("else if taken", () => eq(runKovaSync(`let x = 5\nif x > 10 { return 2 } else if x > 3 { return 1 } else { return 0 }`).returnValue, 1));
test("else if not taken", () => eq(runKovaSync(`let x = 1\nif x > 10 { return 2 } else if x > 3 { return 1 } else { return 0 }`).returnValue, 0));
test("else if catches semantic error", () => assertThrows(() => runKovaSync(`let x = 5\nif x > 10 { return 2 } else if x > 3 { let y = undeclaredVar } else { return 0 }`), "Undeclar"));


// #### Functions ####
console.log("\n Functions");
test("basic fn", () => eq(runKovaSync(`fn add(a, b) { return a + b }\nreturn add(3, 4)`).returnValue, 7));
test("recursion", () => eq(runKovaSync(`fn fact(n) { if n <= 1 { return 1 }\nreturn n * fact(n - 1) }\nreturn fact(5)`).returnValue, 120));
test("closure", () => eq(runKovaSync(`let base = 10\nfn add(x) { return x + base }\nreturn add(5)`).returnValue, 15));
// test("arrow function", () => eq(runKovaSync(`let add = (a, b) => { return a + b }\nreturn add(3, 4)`).returnValue, 15));


// #### Arrays & Objects ####
console.log("\n Arrays & Objects");
test("array literal", () => { const r = runKovaSync(`let a = [1,2,3]  return a`); eq(r.returnValue[1], 2); });
test("array index", () => eq(runKovaSync(`let a = [10,20,30]  return a[1]`).returnValue, 20));
test("array push", () => { const r = runKovaSync(`let a = [1,2]\na.push(3)\nreturn a[2]`); eq(r.returnValue, 3); });
test("object dot", () => eq(runKovaSync(`let o = { x: 42 }  return o.x`).returnValue, 42));
test("object bracket", () => eq(runKovaSync(`let o = { x: 42 }  return o["x"]`).returnValue, 42));
test("nested object", () => eq(runKovaSync(`let o = { inner: { val: 7 } }  return o.inner.val`).returnValue, 7));
test("compound +=", () => eq(runKovaSync(`let x = 5\nx += 3\nreturn x`).returnValue, 8));
test("member +=", () => eq(runKovaSync(`let o = { x: 5 }\no.x += 10\nreturn o.x`).returnValue, 15));

// #### Array Methods ####
console.log("\n Array Methods");
test("map doubles elements", () => {
    const r = runKovaSync(`
let arr = [1, 2, 3]
let doubled = arr.map((x) => { return x * 2 })
return doubled[1]`);
    eq(r.returnValue, 4);
});
test("filter keeps matching elements", () => {
    const r = runKovaSync(`
let arr = [1, 2, 3, 4, 5]
let evens = arr.filter((x) => { return x % 2 == 0 })
return evens[0]`);
    eq(r.returnValue, 2);
});
test("find returns first match", () => {
    const r = runKovaSync(`
let arr = [1, 2, 3, 4]
let found = arr.find((x) => { return x > 2 })
return found`);
    eq(r.returnValue, 3);
});
test("includes returns true", () => {
    const r = runKovaSync(`let arr = [1, 2, 3]\nreturn arr.includes(2)`);
    eq(r.returnValue, true);
});
test("includes returns false", () => {
    const r = runKovaSync(`let arr = [1, 2, 3]\nreturn arr.includes(9)`);
    eq(r.returnValue, false);
});
test("indexOf returns correct index", () => {
    const r = runKovaSync(`let arr = [10, 20, 30]\nreturn arr.indexOf(20)`);
    eq(r.returnValue, 1);
});
test("join concatenates with separator", () => {
    const r = runKovaSync(`let arr = ["a", "b", "c"]\nreturn arr.join("-")`);
    eq(r.returnValue, "a-b-c");
});
test("slice returns subarray", () => {
    const r = runKovaSync(`let arr = [1, 2, 3, 4, 5]\nreturn arr.slice(1, 3)`);
    const v = r.returnValue;
    assert(Array.isArray(v) && v[0] === 2 && v[1] === 3, `Expected [2,3] got ${JSON.stringify(v)}`);
});
test("reverse reverses array", () => {
    const r = runKovaSync(`let arr = [1, 2, 3]\narr.reverse()\nreturn arr[0]`);
    eq(r.returnValue, 3);
});
test("pop removes last element", () => {
    const r = runKovaSync(`let arr = [1, 2, 3]\nlet last = arr.pop()\nreturn last`);
    eq(r.returnValue, 3);
});
test("shift removes first element", () => {
    const r = runKovaSync(`let arr = [1, 2, 3]\nlet first = arr.shift()\nreturn first`);
    eq(r.returnValue, 1);
});

// #### String Methods ####
console.log("\n String Methods");
test("toUpperCase", () => eq(runKovaSync(`return "hello".toUpperCase()`).returnValue, "HELLO"));
test("toLowerCase", () => eq(runKovaSync(`return "HELLO".toLowerCase()`).returnValue, "hello"));
test("trim removes whitespace", () => eq(runKovaSync(`return "  hi  ".trim()`).returnValue, "hi"));
test("split produces array", () => {
    const r = runKovaSync(`let parts = "a,b,c".split(",")\nreturn parts[1]`);
    eq(r.returnValue, "b");
});
test("includes substring true", () => eq(runKovaSync(`return "hello world".includes("world")`).returnValue, true));
test("includes substring false", () => eq(runKovaSync(`return "hello world".includes("xyz")`).returnValue, false));
test("startsWith", () => eq(runKovaSync(`return "hello".startsWith("hel")`).returnValue, true));
test("endsWith", () => eq(runKovaSync(`return "hello".endsWith("llo")`).returnValue, true));
test("replace substitutes first match", () => eq(runKovaSync(`return "hello world".replace("world", "kova")`).returnValue, "hello kova"));
test("slice extracts substring", () => eq(runKovaSync(`return "hello".slice(1, 3)`).returnValue, "el"));
test("indexOf finds char position", () => eq(runKovaSync(`return "hello".indexOf("l")`).returnValue, 2));
test("length of string", () => eq(runKovaSync(`return "hello".length`).returnValue, 5));

// #### Builtins ####
console.log("\n Builtins");
test("abs of negative", () => eq(runKovaSync(`return abs(-5)`).returnValue, 5));
test("sqrt", () => eq(runKovaSync(`return sqrt(9)`).returnValue, 3));
test("floor", () => eq(runKovaSync(`return floor(3.9)`).returnValue, 3));
test("ceil", () => eq(runKovaSync(`return ceil(3.1)`).returnValue, 4));
test("round down", () => eq(runKovaSync(`return round(3.4)`).returnValue, 3));
test("round up", () => eq(runKovaSync(`return round(3.5)`).returnValue, 4));
test("pow", () => eq(runKovaSync(`return pow(2, 8)`).returnValue, 256));
test("max", () => eq(runKovaSync(`return max(1, 9, 3)`).returnValue, 9));
test("min", () => eq(runKovaSync(`return min(1, 9, 3)`).returnValue, 1));
test("random returns number between 0 and 1", () => {
    const r = runKovaSync(`return random()`);
    assert(typeof r.returnValue === "number" && r.returnValue >= 0 && r.returnValue < 1, "random out of range");
});
test("keys returns object keys", () => {
    const r = runKovaSync(`let o = { a: 1, b: 2 }\nreturn keys(o)`);
    assert(Array.isArray(r.returnValue) && r.returnValue.includes("a"), "keys missing 'a'");
});
test("values returns object values", () => {
    const r = runKovaSync(`let o = { a: 1, b: 2 }\nreturn values(o)`);
    assert(Array.isArray(r.returnValue) && r.returnValue.includes(1), "values missing 1");
});
test("flat flattens one level", () => {
    const r = runKovaSync(`let arr = [[1,2],[3,4]]\nreturn flat(arr)`);
    assert(Array.isArray(r.returnValue) && r.returnValue[2] === 3, "flat failed");
});
test("unique removes duplicates", () => {
    const r = runKovaSync(`let arr = [1, 2, 2, 3, 3]\nreturn unique(arr)`);
    assert(r.returnValue.length === 3, `expected 3 unique values got ${r.returnValue.length}`);
});
test("sort sorts array", () => {
    const r = runKovaSync(`let arr = [3, 1, 2]\nreturn sort(arr)`);
    eq(r.returnValue[0], 1);
});
test("toJSON serializes object", () => {
    const r = runKovaSync(`let o = { x: 1 }\nreturn toJSON(o)`);
    eq(r.returnValue, '{"x":1}');
});
test("parseJSON deserializes string", () => {
    const r = runKovaSync(`let s = '{"x":1}'\nlet o = parseJSON(s)\nreturn o.x`);
    eq(r.returnValue, 1);
});
test("toString converts number", () => eq(runKovaSync(`return toString(42)`).returnValue, "42"));
test("toNumber converts string", () => eq(runKovaSync(`return toNumber("42")`).returnValue, 42));
test("now returns a number", () => {
    const r = runKovaSync(`return now()`);
    assert(typeof r.returnValue === "number" && r.returnValue > 0, "now() should return positive number");
});
test("isoDate returns ISO string", () => {
    const r = runKovaSync(`return isoDate()`);
    assert(typeof r.returnValue === "string" && r.returnValue.includes("T"), "isoDate format wrong");
});
test("len of array", () => eq(runKovaSync(`return len([1,2,3])`).returnValue, 3));
test("len of string", () => eq(runKovaSync(`return len("hello")`).returnValue, 5));
test("range produces correct array", () => {
    const r = runKovaSync(`let arr = range(0, 3)\nreturn arr[2]`);
    eq(r.returnValue, 2);
});

// #### HTTP – Basic ####
console.log("\n HTTP – Basic");
test("GET output", () => assert(runKovaSync(`GET "https://api.example.com"`).output.some(l => l.includes("GET"))));
test("POST output", () => assert(runKovaSync(`POST "https://api.example.com"`).output.some(l => l.includes("POST"))));
test("PUT output", () => assert(runKovaSync(`PUT "https://api.example.com"`).output.some(l => l.includes("PUT"))));
test("DELETE output", () => assert(runKovaSync(`DELETE "https://api.example.com"`).output.some(l => l.includes("DELETE"))));
test("PATCH output", () => assert(runKovaSync(`PATCH "https://api.example.com"`).output.some(l => l.includes("PATCH"))));


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
// console.log("\n IMPORT");
// test("named import parsed", () => {
//     const r = runKovaSync(`import { handler, util } from "./routes/users"\nreturn true`);
//     eq(r.returnValue, true);
// });
// test("default import parsed", () => {
//     const r = runKovaSync(`import logger from "./lib/logger"\nreturn true`);
//     eq(r.returnValue, true);
// });


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
test("// comment", () => eq(runKovaSync(`// comment\nlet x = 5\nreturn x`).returnValue, 5));
test("# comment", () => eq(runKovaSync(`# comment\nlet x = 10\nreturn x`).returnValue, 10));
test("/* block */", () => eq(runKovaSync(`/* block */\nlet x = 7\nreturn x`).returnValue, 7));


// #### AI Integration (Prob<T>) — Sync ####
console.log("\n AI Integration (Prob<T>) — Sync");
test("AI() returns a Prob value", () => {
    const r = runKovaSync(`let result = AI("classify", "hello world")\nreturn result`);
    const v = r.returnValue;
    assert(v && v.__prob__ === true, "Expected Prob object");
    assert(v.task === "classify", "Expected task to be set");
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
    assert(r.graph != null, "Expected graph in result");
    assert(r.graph.json != null, "Expected graph.json");
});
test("graph has entry and exit nodes", () => {
    const r = runKovaSync(`let x = 5`);
    const kinds = r.graph.json.nodes.map(n => n.kind);
    assert(kinds.includes("entry"), "No entry node");
    assert(kinds.includes("exit"), "No exit node");
});
test("variable declaration produces declare node", () => {
    const r = runKovaSync(`let name = "Alice"`);
    const declNode = r.graph.json.nodes.find(n => n.kind === "declare");
    assert(declNode != null, "No declare node found");
    assert(declNode.label.includes("name"), `Expected label to include 'name', got: ${declNode.label}`);
});
test("HTTP statement produces http node", () => {
    const r = runKovaSync(`GET "https://api.example.com"`);
    assert(r.graph.json.nodes.some(n => n.kind === "http"), "No http node");
});
test("HTTP into binding captured in node meta", () => {
    const r = runKovaSync(`GET "https://api.example.com/users" into users`);
    const httpNode = r.graph.json.nodes.find(n => n.kind === "http");
    assert(httpNode?.meta?.binding === "users", `Expected binding='users', got: ${httpNode?.meta?.binding}`);
});
test("data dependency edge created for variable reference", () => {
    const r = runKovaSync(`let x = 5\nlet y = x + 1`);
    assert(r.graph.json.edges.some(e => e.kind === "data" && e.label === "x"), "No data edge for x");
});
test("if statement produces if node with control edges", () => {
    const r = runKovaSync(`let x = 5\nif x > 3 { return 1 } else { return 0 }`);
    assert(r.graph.json.nodes.some(n => n.kind === "if"), "No if node");
    assert(r.graph.json.edges.some(e => e.kind === "control" && e.label === "true"), "No control-true edge");
    assert(r.graph.json.edges.some(e => e.kind === "control" && e.label === "false"), "No control-false edge");
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
    const r = runKovaSync(`let x = 5\nlet y = x + 1\nreturn y`);
    const topoLen = r.graph.topologicalOrder.length;
    const nodeLen = r.graph.json.nodes.length;
    assert(topoLen > 0, "Topological order is empty");
    assert(topoLen <= nodeLen, `Topo order (${topoLen}) exceeds node count (${nodeLen})`);
});
test("source nodes exist and exclude entry/exit", () => {
    const r = runKovaSync(`let x = 5\nlet y = 10`);
    const sources = r.graph.sourceNodes;
    assert(Array.isArray(sources), "sourceNodes not an array");
    assert(sources.every(n => !["entry", "exit"].includes(n.kind)), "Source nodes include entry/exit");
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
    const r = runKovaSync(`// no imports here\nlet x = 1`);
    assert(r.graph != null, "graph should exist");
});
test("complex program graph has multiple node kinds", () => {
    const r = runKovaSync(`
connect mysql using { host: "localhost", database: "shop" }
find users where { active: true } limit 10 into users
POST "https://api.example.com/log" save { count: 10 }
respond { status: 200, body: users }`);
    const kinds = new Set(r.graph.json.nodes.map(n => n.kind));
    assert(kinds.has("db_connect"), "Missing db_connect");
    assert(kinds.has("db_find"), "Missing db_find");
    assert(kinds.has("http"), "Missing http");
    assert(kinds.has("respond"), "Missing respond");
});


// #### Sync Results ####
console.log(`\n${"####".repeat(56)}`);
const syncTotal = passed + failed;
console.log(`  ${passed} passed, ${failed} failed out of ${syncTotal} tests (${((passed / syncTotal) * 100).toFixed(1)}%)`);
console.log(`${"####".repeat(56)}\n`);

// #### IMPORT — Async ####
console.log("\n IMPORT — Async");
await testAsync("transitive import: module imports module", async () => {
    const r = await runKova(
        `import { addTen } from "./tests/fixtures/transitive.kova"\nreturn addTen(5)`,
        {}, {},
        { filePath: resolve(process.cwd(), "entry.kova"), aiMode: "stub" }
    );
    eq(r.returnValue, 15);
});
await testAsync("imported fn closes over module-level let", async () => {
    const r = await runKova(
        `import { greet } from "./tests/fixtures/greet.kova"\nreturn greet("Kova")`,
        {}, {},
        { filePath: resolve(process.cwd(), "entry.kova"), aiMode: "stub" }
    );
    eq(r.returnValue, "Hello Kova");
});
await testAsync("imported module fn_def appears in merged graph", async () => {
    const r = await runKova(
        `import { add } from "./tests/fixtures/math.kova"\nreturn add(1, 2)`,
        {}, {},
        { filePath: resolve(process.cwd(), "entry.kova"), aiMode: "stub" }
    );
    assert(
        r.graph.json.nodes.some(n => n.kind === "fn_def" && n.label.includes("add")),
        "fn_def for imported add not in graph"
    );
});
await testAsync("same module imported twice uses cache", async () => {
    const r = await runKova(
        `import { add } from "./tests/fixtures/math.kova"
import { PI } from "./tests/fixtures/math.kova"
return add(1, 1) + PI`,
        {}, {},
        { filePath: resolve(process.cwd(), "entry.kova"), aiMode: "stub" }
    );
    assert(typeof r.returnValue === "number", "should return a number");
});

await testAsync("named import: loads exported fn from fixture", async () => {
    const r = await runKova(
        `import { add } from "./tests/fixtures/math.kova"\nreturn add(3, 4)`,
        {}, {},
        { filePath: resolve(process.cwd(), "entry.kova"), aiMode: "stub" }
    );
    eq(r.returnValue, 7);
});
await testAsync("named import: loads exported let from fixture", async () => {
    const r = await runKova(
        `import { PI } from "./tests/fixtures/math.kova"\nreturn PI`,
        {}, {},
        { filePath: resolve(process.cwd(), "entry.kova"), aiMode: "stub" }
    );
    eq(r.returnValue, 3.14159);
});
await testAsync("import produces import node in graph", async () => {
    const r = await runKova(
        `import { add } from "./tests/fixtures/math.kova"\nreturn add(1, 2)`,
        {}, {},
        { filePath: resolve(process.cwd(), "entry.kova"), aiMode: "stub" }
    );
    assert(r.graph.json.nodes.some(n => n.kind === "import"), "No import node in graph");
});
await testAsync("import throws on missing export", async () => {
    await assertThrowsAsync(
        () => runKova(
            `import { notReal } from "./tests/fixtures/math.kova"`,
            {}, {},
            { filePath: resolve(process.cwd(), "entry.kova"), aiMode: "stub" }
        ),
        `does not export "notReal"`
    );
});
await testAsync("import throws on missing file", async () => {
    await assertThrowsAsync(
        () => runKova(
            `import { x } from "./tests/fixtures/ghost.kova"`,
            {}, {},
            { filePath: resolve(process.cwd(), "entry.kova"), aiMode: "stub" }
        ),
        "Cannot find module"
    );
});

// #### Error Cases ####
console.log("\n Error Cases");
test("access property on null throws", () => {
    assertThrows(() => runKovaSync(`let x = null\nreturn x.foo`), "null");
});
test("unknown array method throws", () => {
    assertThrows(() => runKovaSync(`let a = [1,2]\na.explode()`), "no method");
});
test("unknown string method throws", () => {
    assertThrows(() => runKovaSync(`let s = "hi"\ns.explode()`), "no method");
});
test("assign to undeclared throws", () => {
    assertThrows(() => runKovaSync(`x = 5`), "Undeclared");
});
test("infinite loop guard triggers", () => {
    assertThrows(() => runKovaSync(`let i = 0\nwhile i < 1 { let x = 1 }`), "Infinite loop");
});

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
    assert(r.graph != null, "Expected graph in result");
    assert(r.graph.json != null, "Expected graph.json");
});
await testAsync("runKova graph has ai node for AI() call", async () => {
    const r = await runKova(`
let p = AI("classify", "hello")
let v = resolve(p)
return v`, {}, {}, { aiMode: "stub" });
    assert(r.graph.json.nodes.some(n => n.kind === "ai"), "No ai node in graph");
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
    assert(r.graph.json.nodes.some(n => n.kind === "ai"), "No ai node");
    assert(r.graph.json.nodes.some(n => n.kind === "resolve_prob"), "No resolve_prob node");
});

// console.log("=======> Quick test for unary before exp expressions",runKovaSync(` let x = -2**310
//     print(x)
// `))

// #### Final Results ####
console.log(`\n${"####".repeat(56)}`);
const total = passed + failed;
console.log(`  ${passed} passed, ${failed} failed out of ${total} tests (${((passed / total) * 100).toFixed(1)}%)`);
console.log(`${"####".repeat(56)}\n`);

// console.log(runKovaSync(`let add = (a, b) => { return a + b }\nreturn add(3, 4)`))

if (failed > 0) process.exit(1);