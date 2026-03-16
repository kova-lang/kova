import { RuntimeError } from "../core/diagnostic.js";
import { isProb, resolveProb } from "../ai/groq.js";

export default class Interpreter {
    constructor(externals = {}) {
        this.scopes = [];
        this.output = [];
        this.externals = externals;
        this.returnValue = undefined;
        this.shouldReturn = false;
        this.functions = {};
        this.connections = {};
        this.respondValue = undefined;

        this._builtins = Object.assign(Object.create(null), {
            print: (...args) => {
                const line = args.map(a => this._stringify(a)).join(" ");
                this.output.push(line);
                return null;
            },
            log: (...args) => {
                const line = args.map(a => this._stringify(a)).join(" ");
                this.output.push("[log] " + line);
                return null;
            },
            len: (v) => {
                if (Array.isArray(v)) return v.length;
                if (typeof v === "string") return v.length;
                throw new RuntimeError("len() expects array or string");
            },
            push:     (arr, val) => { arr.push(val); return arr; },
            pop:      (arr)      => arr.pop(),
            keys:     (obj)      => Object.keys(obj),
            values:   (obj)      => Object.values(obj),
            toString: (v)        => String(v),
            toNumber: (v)        => Number(v),
            typeOf:   (v)        => { if (v === null) return "null"; if (Array.isArray(v)) return "array"; if (isProb(v)) return "prob"; return typeof v; },
            range:    (start, end, step = 1) => { const a = []; for (let i = start; i < end; i += step) a.push(i); return a; },
            // resolve() is injected from externals so it gets the real Groq Prob
            parseJSON: (s) => JSON.parse(s),
            toJSON:    (v) => JSON.stringify(v),
            now:       ()  => Date.now(),
            isoDate:   ()  => new Date().toISOString(),
            flat:      (a) => a.flat(),
            unique:    (a) => [...new Set(a)],
            sort:      (a) => [...a].sort(),
            abs:   Math.abs,
            sqrt:  Math.sqrt,
            floor: Math.floor,
            ceil:  Math.ceil,
            round: Math.round,
            pow:   Math.pow,
            max:   Math.max,
            min:   Math.min,
            random: Math.random,
        });
    }

    // #### Async interpret (supports AI() calls) ####

    async interpret(ast) {
        this.returnValue = undefined;
        this.shouldReturn = false;
        this.respondValue = undefined;
        this.output = [];
        this.enterScope();
        await this.visit(ast);
        this.exitScope();
        return {
            returnValue: this.returnValue,
            respondValue: this.respondValue,
            output: this.output,
        };
    }

    // Sync interpret — for tests / no-AI usage
    interpretSync(ast) {
        this.returnValue = undefined;
        this.shouldReturn = false;
        this.respondValue = undefined;
        this.output = [];
        this.enterScope();
        this._visitSync(ast);
        this.exitScope();
        return {
            returnValue: this.returnValue,
            respondValue: this.respondValue,
            output: this.output,
        };
    }

    // #### Scope management ####

    enterScope() { this.scopes.push(new Map()); }
    exitScope()  { this.scopes.pop(); }

    declare(name, value) { this.scopes[this.scopes.length - 1].set(name, value); }

    resolve(name) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) return this.scopes[i].get(name);
        }
        throw new RuntimeError(`Undefined variable "${name}"`);
    }

    assign(name, value) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) { this.scopes[i].set(name, value); return; }
        }
        throw new RuntimeError(`Cannot assign to undeclared variable "${name}"`);
    }

    // #### Async visitor ####

    async visit(node) {
        if (this.shouldReturn) return undefined;
        if (!node) return undefined;

        switch (node.type) {
            case "Program":
                for (const stmt of node.body) {
                    await this.visit(stmt);
                    if (this.shouldReturn) break;
                }
                return undefined;

            case "VariableDeclaration": {
                const value = await this.visit(node.init);
                this.declare(node.id.name, value);
                return undefined;
            }

            case "FunctionDeclaration":
                this.functions[node.name.name] = node;
                this.declare(node.name.name, node);
                return undefined;

            case "Identifier":        return this.resolve(node.name);
            case "Literal":           return node.value;
            case "EnvExpression":     return new Proxy(process.env, { get: (t, k) => t[k] ?? null });

            case "ArrayExpression": {
                const els = [];
                for (const el of node.elements) els.push(await this.visit(el));
                return els;
            }

            case "ObjectExpression": {
                const obj = {};
                for (const prop of node.properties) obj[prop.key] = await this.visit(prop.value);
                return obj;
            }

            case "MemberExpression": {
                const obj = await this.visit(node.object);
                if (obj === null || obj === undefined) throw new RuntimeError("Cannot access property on null/undefined", node);
                const key = node.computed ? await this.visit(node.property) : node.property;
                return obj[key];
            }

            case "BinaryExpression":    return this.evaluateBinary(node, await this.visit(node.left), await this.visit(node.right));
            case "UnaryExpression":     return this.evaluateUnary(node, await this.visit(node.argument));

            case "AssignmentExpression": {
                const value = await this.visit(node.right);
                if (node.left.type === "Identifier") {
                    const name = node.left.name;
                    node.operator === "="
                        ? this.assign(name, value)
                        : this.assign(name, this._applyCompoundOp(node.operator, this.resolve(name), value));
                } else if (node.left.type === "MemberExpression") {
                    const obj = await this.visit(node.left.object);
                    const key = node.left.computed ? await this.visit(node.left.property) : node.left.property;
                    obj[key] = node.operator === "=" ? value : this._applyCompoundOp(node.operator, obj[key], value);
                }
                return value;
            }

            case "BlockStatement":
                this.enterScope();
                for (const stmt of node.body) {
                    await this.visit(stmt);
                    if (this.shouldReturn) break;
                }
                this.exitScope();
                return undefined;

            case "IfStatement": {
                const cond = await this.visit(node.test);
                if (cond) await this.visit(node.consequent);
                else if (node.alternate) await this.visit(node.alternate);
                return undefined;
            }

            case "WhileStatement": {
                let guard = 0;
                while (!this.shouldReturn) {
                    if (!await this.visit(node.test)) break;
                    if (++guard > 100_000) throw new RuntimeError("Infinite loop detected");
                    await this.visit(node.body);
                }
                return undefined;
            }

            case "ForStatement": {
                const iterable = await this.visit(node.iterable);
                if (!Array.isArray(iterable)) throw new RuntimeError("for..in requires an array");
                for (const el of iterable) {
                    if (this.shouldReturn) break;
                    this.enterScope();
                    this.declare(node.id.name, el);
                    await this.visit(node.body);
                    this.exitScope();
                }
                return undefined;
            }

            case "ReturnStatement":
                this.returnValue = await this.visit(node.argument);
                this.shouldReturn = true;
                return undefined;

            case "RespondStatement": {
                const val = await this.visit(node.value);
                this.respondValue = typeof val === "object" && val !== null && !Array.isArray(val) && !isProb(val)
                    ? val
                    : { status: 200, body: val };
                this.output.push("[RESPOND] " + JSON.stringify(this.respondValue));
                return undefined;
            }

            case "ExpressionStatement": return await this.visit(node.expression);

            case "HttpStatement":
            case "HttpExpression":    return await this.executeHttp(node);

            case "ConnectStatement":  return await this.executeConnect(node);
            case "FindStatement":     return await this.executeFind(node);
            case "InsertStatement":   return await this.executeInsert(node);
            case "UpdateStatement":   return await this.executeUpdate(node);

            case "CallExpression":    return await this.executeCall(node);

            case "ArrowFunction":
                return { __kova_fn__: true, node, closure: this.scopes.map(s => new Map(s)) };

            case "ImportStatement":
                node.specifiers.forEach(spec => { try { this.declare(spec, null); } catch (_) {} });
                if (node.defaultImport) { try { this.declare(node.defaultImport, null); } catch (_) {} }
                this.output.push(`[IMPORT] ${node.defaultImport ?? node.specifiers.join(", ")} from "${node.source}"`);
                return undefined;

            case "ExportStatement": return await this.visit(node.declaration);

            default:
                throw new RuntimeError(`Unknown node type: ${node.type}`);
        }
    }

    // #### Sync visitor (for interpretSync / no-AI path) ####

    _visitSync(node) {
        if (this.shouldReturn || !node) return undefined;

        switch (node.type) {
            case "Program":
                for (const stmt of node.body) { this._visitSync(stmt); if (this.shouldReturn) break; }
                return undefined;
            case "VariableDeclaration": { const v = this._visitSync(node.init); this.declare(node.id.name, v); return undefined; }
            case "FunctionDeclaration": this.functions[node.name.name] = node; this.declare(node.name.name, node); return undefined;
            case "Identifier":      return this.resolve(node.name);
            case "Literal":         return node.value;
            case "EnvExpression":   return new Proxy(process.env, { get: (t, k) => t[k] ?? null });
            case "ArrayExpression": return node.elements.map(el => this._visitSync(el));
            case "ObjectExpression": { const obj = {}; node.properties.forEach(p => { obj[p.key] = this._visitSync(p.value); }); return obj; }
            case "MemberExpression": { const obj = this._visitSync(node.object); const key = node.computed ? this._visitSync(node.property) : node.property; return obj[key]; }
            case "BinaryExpression": return this.evaluateBinary(node, this._visitSync(node.left), this._visitSync(node.right));
            case "UnaryExpression":  return this.evaluateUnary(node, this._visitSync(node.argument));
            case "AssignmentExpression": {
                const value = this._visitSync(node.right);
                if (node.left.type === "Identifier") {
                    node.operator === "=" ? this.assign(node.left.name, value) : this.assign(node.left.name, this._applyCompoundOp(node.operator, this.resolve(node.left.name), value));
                } else if (node.left.type === "MemberExpression") {
                    const obj = this._visitSync(node.left.object);
                    const key = node.left.computed ? this._visitSync(node.left.property) : node.left.property;
                    obj[key] = node.operator === "=" ? value : this._applyCompoundOp(node.operator, obj[key], value);
                }
                return value;
            }
            case "BlockStatement": { this.enterScope(); node.body.forEach(s => { if (!this.shouldReturn) this._visitSync(s); }); this.exitScope(); return undefined; }
            case "IfStatement": { const cond = this._visitSync(node.test); if (cond) this._visitSync(node.consequent); else if (node.alternate) this._visitSync(node.alternate); return undefined; }
            case "WhileStatement": { let g = 0; while (!this.shouldReturn && this._visitSync(node.test)) { if (++g > 100_000) throw new RuntimeError("Infinite loop"); this._visitSync(node.body); } return undefined; }
            case "ForStatement": { const it = this._visitSync(node.iterable); for (const el of it) { if (this.shouldReturn) break; this.enterScope(); this.declare(node.id.name, el); this._visitSync(node.body); this.exitScope(); } return undefined; }
            case "ReturnStatement": this.returnValue = this._visitSync(node.argument); this.shouldReturn = true; return undefined;
            case "RespondStatement": { const val = this._visitSync(node.value); this.respondValue = { status: 200, body: val }; this.output.push("[RESPOND] " + JSON.stringify(this.respondValue)); return undefined; }
            case "ExpressionStatement": return this._visitSync(node.expression);
            case "HttpStatement":
            case "HttpExpression": return this._execHttpSync(node);
            case "ConnectStatement": return this._execConnectSync(node);
            case "FindStatement":    return this._execFindSync(node);
            case "InsertStatement":  return this._execInsertSync(node);
            case "UpdateStatement":  return this._execUpdateSync(node);
            case "CallExpression":   return this._execCallSync(node);
            case "ArrowFunction":    return { __kova_fn__: true, node, closure: this.scopes.map(s => new Map(s)) };
            case "ImportStatement":  node.specifiers.forEach(s => { try { this.declare(s, null); } catch (_) {} }); if (node.defaultImport) { try { this.declare(node.defaultImport, null); } catch (_) {} } return undefined;
            case "ExportStatement":  return this._visitSync(node.declaration);
            default: throw new RuntimeError(`Unknown node type: ${node.type}`);
        }
    }

    // #### HTTP ####

    async executeHttp(node) {
        const url    = await this.visit(node.url);
        const body   = node.body    ? await this.visit(node.body)    : null;
        const method = node.method.replace("_HTTP", "");
        this.output.push(`[HTTP] ${method} -> ${url}`);
        if (body) this.output.push(`       body: ${JSON.stringify(body)}`);
        const response = { status: 200, ok: true, url, method, body: null, __kova_http__: true };
        if (node.binding) this._bindOrDeclare(node.binding.name, response);
        return response;
    }

    _execHttpSync(node) {
        const url    = this._visitSync(node.url);
        const body   = node.body ? this._visitSync(node.body) : null;
        const method = node.method.replace("_HTTP", "");
        this.output.push(`[HTTP] ${method} -> ${url}`);
        const response = { status: 200, ok: true, url, method, body: null, __kova_http__: true };
        if (node.binding) this._bindOrDeclare(node.binding.name, response);
        return response;
    }

    // #### DB ####

    async executeConnect(node) {
        const config = await this.visit(node.config);
        const name   = node.binding?.name ?? node.driver;
        const conn   = { driver: node.driver, config, connected: true, __kova_conn__: true };
        this.connections[name] = conn;
        this._bindOrDeclare(name, conn);
        this.output.push(`[DB] Connected to ${node.driver}`);
        return conn;
    }
    _execConnectSync(node) {
        const config = this._visitSync(node.config);
        const name   = node.binding?.name ?? node.driver;
        const conn   = { driver: node.driver, config, connected: true, __kova_conn__: true };
        this._bindOrDeclare(name, conn);
        this.output.push(`[DB] Connected to ${node.driver}`);
        return conn;
    }

    async executeFind(node) {
        const filter = node.filter ? await this.visit(node.filter) : {};
        const limitV = node.limit  ? await this.visit(node.limit)  : null;
        const orderBy = node.orderBy ?? null;
        const result = { type: "cursor", collection: node.collection, filter, limit: limitV, orderBy, rows: [], __kova_db__: true };
        this.output.push(`[DB] find ${node.collection}`);
        if (node.binding) this._bindOrDeclare(node.binding.name, result);
        return result;
    }
    _execFindSync(node) {
        const filter  = node.filter  ? this._visitSync(node.filter) : {};
        const limitV  = node.limit   ? this._visitSync(node.limit)  : null;
        const orderBy = node.orderBy ?? null;
        const result = { type: "cursor", collection: node.collection, filter, limit: limitV, orderBy, rows: [], __kova_db__: true };
        this.output.push(`[DB] find ${node.collection}`);
        if (node.binding) this._bindOrDeclare(node.binding.name, result);
        return result;
    }

    async executeInsert(node) {
        const document = await this.visit(node.document);
        const result   = { type: "insertResult", collection: node.collection, document, insertedId: `id_${Date.now()}`, __kova_db__: true };
        this.output.push(`[DB] insert into ${node.collection}`);
        if (node.binding) this._bindOrDeclare(node.binding.name, result);
        return result;
    }
    _execInsertSync(node) {
        const document = this._visitSync(node.document);
        const result   = { type: "insertResult", collection: node.collection, document, insertedId: `id_${Date.now()}`, __kova_db__: true };
        this.output.push(`[DB] insert into ${node.collection}`);
        if (node.binding) this._bindOrDeclare(node.binding.name, result);
        return result;
    }

    async executeUpdate(node) {
        const updates = await this.visit(node.updates);
        const filter  = node.filter ? await this.visit(node.filter) : {};
        const result  = { type: "updateResult", collection: node.collection, updates, filter, modifiedCount: 1, __kova_db__: true };
        this.output.push(`[DB] update ${node.collection}`);
        if (node.binding) this._bindOrDeclare(node.binding.name, result);
        return result;
    }
    _execUpdateSync(node) {
        const updates = this._visitSync(node.updates);
        const filter  = node.filter ? this._visitSync(node.filter) : {};
        const result  = { type: "updateResult", collection: node.collection, updates, filter, modifiedCount: 1, __kova_db__: true };
        this.output.push(`[DB] update ${node.collection}`);
        if (node.binding) this._bindOrDeclare(node.binding.name, result);
        return result;
    }

    // #### Function calls (async) ####

    async executeCall(node) {
        if (node.callee.type === "MemberExpression") return await this.executeMemberCall(node);

        const fnName = node.callee.name;
        const args   = [];
        for (const a of node.arguments) args.push(await this.visit(a));

        if (fnName in this._builtins) return this._builtins[fnName](...args);
        if (this.functions[fnName])   return await this.callUserFunction(this.functions[fnName], args);
        if (Object.prototype.hasOwnProperty.call(this.externals, fnName)) {
            const result = await this.externals[fnName](...args);
            return result;
        }
        throw new RuntimeError(`Unknown function "${fnName}"`);
    }

    _execCallSync(node) {
        if (node.callee.type === "MemberExpression") return this._execMemberCallSync(node);
        const fnName = node.callee.name;
        const args   = node.arguments.map(a => this._visitSync(a));
        if (fnName in this._builtins) return this._builtins[fnName](...args);
        if (this.functions[fnName])   return this._callUserFnSync(this.functions[fnName], args);
        if (Object.prototype.hasOwnProperty.call(this.externals, fnName)) return this.externals[fnName](...args);
        throw new RuntimeError(`Unknown function "${fnName}"`);
    }

    async callUserFunction(fnNode, args) {
        const prevReturn = this.returnValue, prevShould = this.shouldReturn;
        this.returnValue = undefined; this.shouldReturn = false;
        this.enterScope();
        fnNode.params.forEach((p, i) => this.declare(p.name, args[i] ?? null));
        for (const stmt of fnNode.body.body) { await this.visit(stmt); if (this.shouldReturn) break; }
        this.exitScope();
        const result = this.returnValue;
        this.returnValue = prevReturn; this.shouldReturn = prevShould;
        return result;
    }

    _callUserFnSync(fnNode, args) {
        const prevReturn = this.returnValue, prevShould = this.shouldReturn;
        this.returnValue = undefined; this.shouldReturn = false;
        this.enterScope();
        fnNode.params.forEach((p, i) => this.declare(p.name, args[i] ?? null));
        fnNode.body.body.forEach(s => { if (!this.shouldReturn) this._visitSync(s); });
        this.exitScope();
        const result = this.returnValue;
        this.returnValue = prevReturn; this.shouldReturn = prevShould;
        return result;
    }

    async executeMemberCall(node) {
        const obj    = await this.visit(node.callee.object);
        const method = node.callee.property;
        const args   = [];
        for (const a of node.arguments) args.push(await this.visit(a));
        return this._callMethod(obj, method, args);
    }

    _execMemberCallSync(node) {
        const obj    = this._visitSync(node.callee.object);
        const method = node.callee.property;
        const args   = node.arguments.map(a => this._visitSync(a));
        return this._callMethod(obj, method, args);
    }

    _callMethod(obj, method, args) {
        if (Array.isArray(obj)) {
            switch (method) {
                case "push":    obj.push(...args); return obj;
                case "pop":     return obj.pop();
                case "shift":   return obj.shift();
                case "unshift": obj.unshift(...args); return obj;
                case "length":  return obj.length;
                case "includes": return obj.includes(args[0]);
                case "indexOf":  return obj.indexOf(args[0]);
                case "join":     return obj.join(args[0] ?? ",");
                case "slice":    return obj.slice(...args);
                case "reverse":  return obj.reverse();
                case "map":    return obj.map(el => this._callArbitraryFn(args[0], [el]));
                case "filter": return obj.filter(el => this._callArbitraryFn(args[0], [el]));
                case "find":   return obj.find(el => this._callArbitraryFn(args[0], [el])) ?? null;
                case "forEach": obj.forEach(el => this._callArbitraryFn(args[0], [el])); return null;
                default: throw new RuntimeError(`Array has no method "${method}"`);
            }
        }
        if (typeof obj === "string") {
            switch (method) {
                case "length":      return obj.length;
                case "toUpperCase": return obj.toUpperCase();
                case "toLowerCase": return obj.toLowerCase();
                case "trim":        return obj.trim();
                case "split":       return obj.split(args[0] ?? "");
                case "includes":    return obj.includes(args[0]);
                case "startsWith":  return obj.startsWith(args[0]);
                case "endsWith":    return obj.endsWith(args[0]);
                case "replace":     return obj.replace(args[0], args[1]);
                case "slice":       return obj.slice(...args);
                case "indexOf":     return obj.indexOf(args[0]);
                default: throw new RuntimeError(`String has no method "${method}"`);
            }
        }
        if (typeof obj === "object" && obj !== null) {
            switch (method) {
                case "keys":   return Object.keys(obj);
                case "values": return Object.values(obj);
                case "has":    return Object.prototype.hasOwnProperty.call(obj, args[0]);
                default:
                    if (typeof obj[method] === "function") return obj[method](...args);
                    throw new RuntimeError(`Object has no method "${method}"`);
            }
        }
        throw new RuntimeError(`Cannot call method "${method}" on ${typeof obj}`);
    }

    _callArbitraryFn(fn, args) {
        if (fn && fn.__kova_fn__) {
            const saved = this.scopes;
            this.scopes  = fn.closure.map(s => new Map(s));
            this.enterScope();
            fn.node.params.forEach((p, i) => this.declare(p.name, args[i] ?? null));
            let result;
            if (fn.node.body.type === "BlockStatement") {
                const prev = this.returnValue, prevS = this.shouldReturn;
                this.returnValue = undefined; this.shouldReturn = false;
                fn.node.body.body.forEach(s => { if (!this.shouldReturn) this._visitSync(s); });
                result = this.returnValue;
                this.returnValue = prev; this.shouldReturn = prevS;
            } else {
                result = this._visitSync(fn.node.body);
            }
            this.exitScope();
            this.scopes = saved;
            return result;
        }
        if (typeof fn === "function") return fn(...args);
        throw new RuntimeError("Expected a callable function");
    }

    // #### Helper: bind to existing var or declare new ####

    _bindOrDeclare(name, value) {
        try { this.assign(name, value); } catch (_) { this.declare(name, value); }
    }

    // #### Evaluation ####

    evaluateBinary(node, left, right) {
        switch (node.operator) {
            case "+":  return left + right;
            case "-":  return left - right;
            case "*":  return left * right;
            case "/":  if (right === 0) throw new RuntimeError("Division by zero"); return left / right;
            case "%":  return left % right;
            case "==": return left === right;
            case "!=": return left !== right;
            case ">":  return left > right;
            case "<":  return left < right;
            case ">=": return left >= right;
            case "<=": return left <= right;
            case "&&": return left && right;
            case "||": return left || right;
            default:   throw new RuntimeError(`Unknown operator "${node.operator}"`);
        }
    }

    evaluateUnary(node, value) {
        switch (node.operator) {
            case "-": return -value;
            case "!": return !value;
            default:  throw new RuntimeError(`Unknown unary operator "${node.operator}"`);
        }
    }

    _applyCompoundOp(op, current, value) {
        switch (op) {
            case "+=": return current + value;
            case "-=": return current - value;
            case "*=": return current * value;
            case "/=": return current / value;
            default:   throw new RuntimeError(`Unknown compound operator ${op}`);
        }
    }

    _stringify(v) {
        if (v === null || v === undefined) return "null";
        if (isProb(v)) return `Prob<${this._stringify(v.value)}> [confidence=${v.confidence}]`;
        if (Array.isArray(v)) return "[" + v.map(e => this._stringify(e)).join(", ") + "]";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
    }
}
