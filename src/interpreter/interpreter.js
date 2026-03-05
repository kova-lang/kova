import { RuntimeError } from "../core/diagnostic.js";

export default class Interpreter {
    constructor(externals = {}) {
        this.scopes = [];
        this.output = [];
        this.externals = externals;
        this.returnValue = undefined;
        this.shouldReturn = false;
        this.functions = {};
        this.connections = {}; // named DB connections: connName → driver adapter
        this.respondValue = undefined; // set by respond statement

        this._builtins = Object.assign(Object.create(null), {
            print: (...args) => {
                const line = args.map(a => this._stringify(a)).join(" ");
                this.output.push(line);
                return null;
            },
            len: (v) => {
                if (Array.isArray(v)) return v.length;
                if (typeof v === "string") return v.length;
                throw new RuntimeError(`len() expects array or string`);
            },
            push: (arr, val) => { if (!Array.isArray(arr)) throw new RuntimeError("push() expects an array"); arr.push(val); return arr; },
            pop:  (arr) => { if (!Array.isArray(arr)) throw new RuntimeError("pop() expects an array"); return arr.pop(); },
            keys:   (obj) => Object.keys(obj),
            values: (obj) => Object.values(obj),
            toString: (v) => String(v),
            toNumber: (v) => Number(v),
            typeOf:   (v) => { if (v === null) return "null"; if (Array.isArray(v)) return "array"; return typeof v; },
            range: (start, end, step = 1) => { const arr = []; for (let i = start; i < end; i += step) arr.push(i); return arr; },
            resolve: (v) => v,
        });
    }

    interpret(ast) {
        this.returnValue = undefined;
        this.shouldReturn = false;
        this.respondValue = undefined;
        this.output = [];
        this.enterScope();
        this.visit(ast);
        this.exitScope();
        return {
            returnValue: this.returnValue,
            respondValue: this.respondValue,
            output: this.output,
        };
    }

    // ─── Scope management ─────────────────────────────────────────────────────

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

    // ─── Visitor ──────────────────────────────────────────────────────────────

    visit(node) {
        if (this.shouldReturn) return undefined;
        if (!node) return undefined;

        switch (node.type) {

            case "Program":
                for (const stmt of node.body) {
                    this.visit(stmt);
                    if (this.shouldReturn) break;
                }
                return undefined;

            case "VariableDeclaration": {
                const value = this.visit(node.init);
                this.declare(node.id.name, value);
                return undefined;
            }

            case "FunctionDeclaration":
                this.functions[node.name.name] = node;
                this.declare(node.name.name, node);
                return undefined;

            case "Identifier":        return this.resolve(node.name);
            case "Literal":           return node.value;

            case "EnvExpression":
                // Returns a proxy-like object over process.env
                return new Proxy(process.env, {
                    get: (target, key) => target[key] ?? null,
                });

            case "ArrayExpression":   return node.elements.map(el => this.visit(el));

            case "ObjectExpression": {
                const obj = {};
                for (const prop of node.properties) obj[prop.key] = this.visit(prop.value);
                return obj;
            }

            case "MemberExpression": {
                const obj = this.visit(node.object);
                if (obj === null || obj === undefined) throw new RuntimeError(`Cannot access property on null/undefined`, node);
                const key = node.computed ? this.visit(node.property) : node.property;
                return obj[key];
            }

            case "BinaryExpression":    return this.evaluateBinary(node);
            case "UnaryExpression":     return this.evaluateUnary(node);

            case "AssignmentExpression": {
                const value = this.visit(node.right);
                if (node.left.type === "Identifier") {
                    const name = node.left.name;
                    node.operator === "="
                        ? this.assign(name, value)
                        : this.assign(name, this._applyCompoundOp(node.operator, this.resolve(name), value));
                } else if (node.left.type === "MemberExpression") {
                    const obj = this.visit(node.left.object);
                    const key = node.left.computed ? this.visit(node.left.property) : node.left.property;
                    obj[key] = node.operator === "=" ? value : this._applyCompoundOp(node.operator, obj[key], value);
                }
                return value;
            }

            case "BlockStatement":
                this.enterScope();
                for (const stmt of node.body) {
                    this.visit(stmt);
                    if (this.shouldReturn) break;
                }
                this.exitScope();
                return undefined;

            case "IfStatement": {
                const cond = this.visit(node.test);
                if (cond) this.visit(node.consequent);
                else if (node.alternate) this.visit(node.alternate);
                return undefined;
            }

            case "WhileStatement": {
                let guard = 0;
                while (!this.shouldReturn) {
                    if (!this.visit(node.test)) break;
                    if (++guard > 100_000) throw new RuntimeError("Infinite loop detected");
                    this.visit(node.body);
                }
                return undefined;
            }

            case "ForStatement": {
                const iterable = this.visit(node.iterable);
                if (!Array.isArray(iterable)) throw new RuntimeError("for..in requires an array");
                for (const el of iterable) {
                    if (this.shouldReturn) break;
                    this.enterScope();
                    this.declare(node.id.name, el);
                    this.visit(node.body);
                    this.exitScope();
                }
                return undefined;
            }

            case "ReturnStatement":
                this.returnValue = this.visit(node.argument);
                this.shouldReturn = true;
                return undefined;

            case "RespondStatement": {
                const val = this.visit(node.value);
                this.respondValue = typeof val === "object" && val !== null && !Array.isArray(val)
                    ? val
                    : { status: 200, body: val };
                this.output.push(`[RESPOND] ${JSON.stringify(this.respondValue)}`);
                return undefined;
            }

            case "ExpressionStatement": return this.visit(node.expression);

            // ── HTTP ────────────────────────────────────────────────────────
            case "HttpStatement":
            case "HttpExpression":
                return this.executeHttp(node);

            // ── DB ──────────────────────────────────────────────────────────
            case "ConnectStatement":  return this.executeConnect(node);
            case "FindStatement":     return this.executeFind(node);
            case "InsertStatement":   return this.executeInsert(node);
            case "UpdateStatement":   return this.executeUpdate(node);

            case "CallExpression":    return this.executeCall(node);

            case "ArrowFunction":
                return { __kova_fn__: true, node, closure: this.scopes.map(s => new Map(s)) };

            case "ImportStatement":
                // At runtime: register specifiers as declared (resolved statically in real runtime)
                node.specifiers.forEach(spec => { try { this.declare(spec, null); } catch (_) {} });
                if (node.defaultImport) { try { this.declare(node.defaultImport, null); } catch (_) {} }
                this.output.push(`[IMPORT] ${node.defaultImport ?? node.specifiers.join(", ")} from "${node.source}"`);
                return undefined;

            case "ExportStatement":   return this.visit(node.declaration);

            default:
                throw new RuntimeError(`Unknown node type: ${node.type}`);
        }
    }

    // ─── HTTP execution ───────────────────────────────────────────────────────

    executeHttp(node) {
        const url     = this.visit(node.url);
        const body    = node.body    ? this.visit(node.body)    : null;
        const headers = node.headers ? this.visit(node.headers) : {};
        const method  = node.method.replace("_HTTP", "");

        this.output.push(`[HTTP] ${method} → ${url}`);
        if (body) this.output.push(`       body: ${JSON.stringify(body)}`);

        const response = { status: 200, ok: true, url, method, body: null, __kova_http__: true };

        // Bind result to variable if  into <name>  was specified
        if (node.binding) {
            this._bindOrDeclare(node.binding.name, response);
        }

        return response;
    }

    // ─── DB / Connection execution ────────────────────────────────────────────

    executeConnect(node) {
        const config = this.visit(node.config);
        const connName = node.binding?.name ?? node.driver;

        const connection = {
            driver: node.driver,
            config,
            connected: true,
            __kova_conn__: true,
        };

        this.connections[connName] = connection;
        this._bindOrDeclare(connName, connection);
        this.output.push(`[DB] Connected to ${node.driver} (${config.host ?? config.database ?? ""})`);
        return connection;
    }

    executeFind(node) {
        const filter  = node.filter   ? this.visit(node.filter)  : {};
        const limitV  = node.limit    ? this.visit(node.limit)   : null;
        const orderBy = node.orderBy;

        const result = {
            type: "cursor",
            collection: node.collection,
            filter,
            limit: limitV,
            orderBy,
            rows: [],
            __kova_db__: true,
        };

        this.output.push(`[DB] find ${node.collection} ${JSON.stringify(filter)}${limitV ? ` limit ${limitV}` : ""}${orderBy ? ` order_by ${orderBy.field} ${orderBy.direction}` : ""}`);

        if (node.binding) this._bindOrDeclare(node.binding.name, result);
        return result;
    }

    executeInsert(node) {
        const document = this.visit(node.document);
        const result = { type: "insertResult", collection: node.collection, document, insertedId: `id_${Date.now()}`, __kova_db__: true };

        this.output.push(`[DB] insert into ${node.collection} ${JSON.stringify(document)}`);

        if (node.binding) this._bindOrDeclare(node.binding.name, result);
        return result;
    }

    executeUpdate(node) {
        const updates = this.visit(node.updates);
        const filter  = node.filter ? this.visit(node.filter) : {};
        const result  = { type: "updateResult", collection: node.collection, updates, filter, modifiedCount: 1, __kova_db__: true };

        this.output.push(`[DB] update ${node.collection} set ${JSON.stringify(updates)} where ${JSON.stringify(filter)}`);

        if (node.binding) this._bindOrDeclare(node.binding.name, result);
        return result;
    }

    // ─── Helper: bind result to existing var or declare new one ──────────────

    _bindOrDeclare(name, value) {
        try {
            this.assign(name, value);
        } catch (_) {
            this.declare(name, value);
        }
    }

    // ─── Function calls ───────────────────────────────────────────────────────

    executeCall(node) {
        if (node.callee.type === "MemberExpression") return this.executeMemberCall(node);

        const fnName = node.callee.name;
        const args   = node.arguments.map(a => this.visit(a));

        if (fnName in this._builtins)              return this._builtins[fnName](...args);
        if (this.functions[fnName])                return this.callUserFunction(this.functions[fnName], args);
        if (Object.prototype.hasOwnProperty.call(this.externals, fnName)) return this.externals[fnName](...args);

        throw new RuntimeError(`Unknown function "${fnName}"`);
    }

    callUserFunction(fnNode, args) {
        const prevReturn      = this.returnValue;
        const prevShouldReturn = this.shouldReturn;
        this.returnValue  = undefined;
        this.shouldReturn = false;

        this.enterScope();
        fnNode.params.forEach((param, i) => this.declare(param.name, args[i] ?? null));
        for (const stmt of fnNode.body.body) {
            this.visit(stmt);
            if (this.shouldReturn) break;
        }
        this.exitScope();

        const result        = this.returnValue;
        this.returnValue    = prevReturn;
        this.shouldReturn   = prevShouldReturn;
        return result;
    }

    executeMemberCall(node) {
        const obj    = this.visit(node.callee.object);
        const method = node.callee.property;
        const args   = node.arguments.map(a => this.visit(a));

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
                case "map":    return obj.map(el => this.callArbitraryFn(args[0], [el]));
                case "filter": return obj.filter(el => this.callArbitraryFn(args[0], [el]));
                case "find":   return obj.find(el => this.callArbitraryFn(args[0], [el])) ?? null;
                case "forEach": obj.forEach(el => this.callArbitraryFn(args[0], [el])); return null;
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

    callArbitraryFn(fn, args) {
        if (fn && fn.__kova_fn__) {
            const fnNode = fn.node;
            const saved  = this.scopes;
            this.scopes  = fn.closure.map(s => new Map(s));
            this.enterScope();
            fnNode.params.forEach((p, i) => this.declare(p.name, args[i] ?? null));
            let result;
            if (fnNode.body.type === "BlockStatement") {
                const prev = this.returnValue, prevS = this.shouldReturn;
                this.returnValue = undefined; this.shouldReturn = false;
                fnNode.body.body.forEach(s => { if (!this.shouldReturn) this.visit(s); });
                result = this.returnValue;
                this.returnValue = prev; this.shouldReturn = prevS;
            } else {
                result = this.visit(fnNode.body);
            }
            this.exitScope();
            this.scopes = saved;
            return result;
        }
        if (typeof fn === "function") return fn(...args);
        throw new RuntimeError("Expected a callable function");
    }

    // ─── Evaluation helpers ───────────────────────────────────────────────────

    evaluateBinary(node) {
        const left  = this.visit(node.left);
        const right = this.visit(node.right);
        switch (node.operator) {
            case "+":  return left + right;
            case "-":  return left - right;
            case "*":  return left * right;
            case "/":  if (right === 0) throw new RuntimeError("Division by zero", node); return left / right;
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

    evaluateUnary(node) {
        const value = this.visit(node.argument);
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
        if (Array.isArray(v)) return "[" + v.map(e => this._stringify(e)).join(", ") + "]";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
    }
}
