import { Diagnostic } from "../core/diagnostic.js";

export default class SemanticAnalyzer {
    constructor(source, externals = {}, externalSignatures = {}) {
        this.source = source;
        this.scopes = [];
        this.externals = externals;
        this.externalSignatures = externalSignatures;
        this.currentReturnType = null;
        this.functions = {};
    }

    // #### Prob helpers ####
    Prob(inner) { return { kind: "prob", inner }; }
    isProb(t) { return t && typeof t === "object" && t.kind === "prob"; }
    unwrapProb(t) { return t.inner; }

    // #### Scope helpers ####
    enterScope() { this.scopes.push(new Map()); }
    exitScope() { this.scopes.pop(); }

    declare(name, type) {
        const scope = this.scopes[this.scopes.length - 1];
        if (scope.has(name)) throw new Error(`Variable "${name}" already declared in this scope`);
        scope.set(name, type);
    }

    resolve(name, node = null) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) return this.scopes[i].get(name);
        }
        if (Object.prototype.hasOwnProperty.call(this.externals, name)) return "external";
        if (this.functions[name]) return "function";
        throw new Diagnostic(`Undeclared variable "${name}"`, node, this.source);
    }

    analyze(ast) {
        this.enterScope();
        this.visit(ast);
        this.exitScope();
    }

    visit(node) {
        if (!node) return null;

        switch (node.type) {

            case "Program":
                node.body.forEach(s => this.visit(s));
                return null;

            case "VariableDeclaration": {
                this.declare(node.id.name, "unknown");
                const t = this.visit(node.init);
                if (node.typeAnnotation && t !== node.typeAnnotation && t !== "unknown") {
                    this.error(`Type mismatch: declared ${node.typeAnnotation} but got ${t}`, node);
                }
                this.scopes[this.scopes.length - 1].set(node.id.name, t);
                return t;
            }

            case "FunctionDeclaration": {
                this.functions[node.name.name] = node.returnType ?? "unknown";
                this.declare(node.name.name, "function");
                this.enterScope();
                node.params.forEach(p => this.declare(p.name, p.typeAnnotation ?? "unknown"));
                const prevReturn = this.currentReturnType;
                this.currentReturnType = null;
                node.body.body.forEach(s => this.visit(s));
                if (node.returnType && this.currentReturnType && node.returnType !== this.currentReturnType) {
                    this.error(`Function "${node.name.name}" declared return type ${node.returnType} but returns ${this.currentReturnType}`, node);
                }
                this.currentReturnType = prevReturn;
                this.exitScope();
                return "function";
            }

            case "Identifier": return this.resolve(node.name, node);
            case "Literal": return node.value === null ? "null" : typeof node.value;
            case "EnvExpression": return "object"; // process.env is an object

            case "ArrayExpression":
                node.elements.forEach(el => this.visit(el));
                return "array";

            case "ObjectExpression":
                node.properties.forEach(p => this.visit(p.value));
                return "object";

            case "MemberExpression": {
                const objType = this.visit(node.object);
                if (!["object", "array", "string", "external", "unknown"].includes(objType)) {
                    this.error(`Cannot access property on type "${objType}"`, node);
                }
                return "unknown";
            }

            case "BinaryExpression": {
                const L = this.visit(node.left);
                const R = this.visit(node.right);
                const op = node.operator;

                if (this.isProb(L) || this.isProb(R)) this.error("Probabilistic values must be resolved before use", node);

                if (["+", "-", "*", "/", "%"].includes(op)) {
                    if (op === "+" && L === "string" && R === "string") return "string";
                    if (L !== "unknown" && R !== "unknown" && (L !== "number" || R !== "number")) {
                        this.error(`Arithmetic operators require numbers, got ${L} and ${R}`, node);
                    }
                    return "number";
                }
                if ([">", "<", ">=", "<="].includes(op)) {
                    if (L !== "unknown" && R !== "unknown" && (L !== "number" || R !== "number")) {
                        this.error(`Comparison operators require numbers`, node);
                    }
                    return "boolean";
                }
                if (["==", "!="].includes(op)) {
                    if (L !== R && L !== "unknown" && R !== "unknown") {
                        this.error(`Equality operands must be the same type, got ${L} and ${R}`, node);
                    }
                    return "boolean";
                }
                if (["&&", "||"].includes(op)) {
                    if (L !== "boolean" || R !== "boolean") this.error(`Logical operators require booleans`, node);
                    return "boolean";
                }
                this.error(`Unknown operator "${op}"`, node);
                break;
            }
            case "PowerExpression": {
                const L = this.visit(node.left);
                const R = this.visit(node.right);
                const op = node.op;

                if (node.op === "**") {
                    if (L !== "unknown" && R !== "unknown" && (L !== "number" || R !== "number")) {
                        this.error(`Arithmetic operators require numbers, got ${L} and ${R}`, node);
                    }
                    return "number";
                }
                this.error(`Unknown operator "${op}"`, node);
                break;
            }

            case "UnaryExpression": {
                const argType = this.visit(node.argument);
                if (this.isProb(argType)) this.error("Probabilistic values must be resolved before use", node);
                if (node.operator === "-" && argType !== "number" && argType !== "unknown") this.error("Unary '-' requires a number", node);
                if (node.operator === "!" && argType !== "boolean" && argType !== "unknown") this.error("Unary '!' requires a boolean", node);
                return argType;
            }

            case "IfStatement": {
                const testType = this.visit(node.test);
                if (this.isProb(testType)) this.error("Probabilistic value cannot be used in 'if' condition. Use resolve().", node.test);
                if (testType !== "boolean" && testType !== "unknown") this.error(`If condition must be boolean, got "${testType}"`, node);
                const consReturn = this.analyzeBranch(node.consequent);
                const altReturn = node.alternate ? this.analyzeBranch(node.alternate) : null;
                if (consReturn && altReturn && consReturn !== altReturn) this.error(`Mismatched return types: ${consReturn} vs ${altReturn}`, node);
                return consReturn ?? altReturn ?? null;
            }

            case "WhileStatement": {
                const testType = this.visit(node.test);
                if (testType !== "boolean" && testType !== "unknown") this.error(`While condition must be boolean, got "${testType}"`, node);
                this.enterScope();
                node.body.body.forEach(s => this.visit(s));
                this.exitScope();
                return null;
            }

            case "ForStatement": {
                this.enterScope();
                const iterType = this.visit(node.iterable);
                if (iterType !== "array" && iterType !== "unknown") this.error(`For..in requires an array, got "${iterType}"`, node);
                this.declare(node.id.name, "unknown");
                node.body.body.forEach(s => this.visit(s));
                this.exitScope();
                return null;
            }

            case "BlockStatement":
                this.enterScope();
                node.body.forEach(s => this.visit(s));
                this.exitScope();
                return null;

            case "ReturnStatement": {
                const t = this.visit(node.argument);
                this.currentReturnType = t;
                return t;
            }

            case "AssignmentExpression": {
                this.visit(node.left);
                this.visit(node.right);
                return "unknown";
            }

            case "ExpressionStatement": return this.visit(node.expression);

            // #### HTTP ####
            case "HttpStatement": {
                this.visit(node.url);
                if (node.body) this.visit(node.body);
                if (node.headers) this.visit(node.headers);
                // Bind result variable into scope
                if (node.binding) {
                    try { this.declare(node.binding.name, "object"); } catch (_) { }
                }
                return null;
            }

            case "HttpExpression": {
                this.visit(node.url);
                if (node.body) this.visit(node.body);
                if (node.headers) this.visit(node.headers);
                return "object";
            }

            // #### respond ####
            case "RespondStatement":
                this.visit(node.value);
                return null;

            // #### DB ####
            case "ConnectStatement":
                this.visit(node.config);
                if (node.binding) {
                    try { this.declare(node.binding.name, "object"); } catch (_) { }
                }
                // Also declare the driver name as default connection variable
                try { this.declare(node.driver, "object"); } catch (_) { }
                return "object";

            case "FindStatement":
                if (node.filter) this.visit(node.filter);
                if (node.limit) this.visit(node.limit);
                if (node.binding) {
                    try { this.declare(node.binding.name, "array"); } catch (_) { }
                }
                return "array";

            case "InsertStatement":
                this.visit(node.document);
                if (node.binding) {
                    try { this.declare(node.binding.name, "object"); } catch (_) { }
                }
                return "object";

            case "UpdateStatement":
                this.visit(node.updates);
                if (node.filter) this.visit(node.filter);
                if (node.binding) {
                    try { this.declare(node.binding.name, "object"); } catch (_) { }
                }
                return "object";

            // #### Imports ####
            case "ImportStatement":
                node.specifiers.forEach(spec => { try { this.declare(spec, "unknown"); } catch (_) { } });
                if (node.defaultImport) { try { this.declare(node.defaultImport, "unknown"); } catch (_) { } }
                return null;

            case "ExportStatement": return this.visit(node.declaration);

            // #### Functions ####
            case "CallExpression": {
                if (node.callee.type === "MemberExpression") {
                    node.arguments.forEach(a => this.visit(a));
                    return "unknown";
                }

                const fnName = node.callee.name;

                if (fnName === "resolve") {
                    if (node.arguments.length !== 1) this.error("resolve() takes exactly one argument", node);
                    const argType = this.visit(node.arguments[0]);
                    if (!this.isProb(argType)) this.error("resolve() expects a probabilistic value", node);
                    return this.unwrapProb(argType);
                }

                // Core built-ins
                const BUILTINS = { print: "null", len: "number", push: "null", pop: "unknown", keys: "array", values: "array", toString: "string", toNumber: "number", typeOf: "string", range: "array", resolve: "unknown" };
                if (Object.prototype.hasOwnProperty.call(BUILTINS, fnName)) {
                    node.arguments.forEach(a => this.visit(a));
                    return BUILTINS[fnName];
                }

                // User-declared function
                if (this.functions[fnName]) {
                    node.arguments.forEach(a => this.visit(a));
                    return this.functions[fnName];
                }

                // External
                if (!Object.prototype.hasOwnProperty.call(this.externals, fnName)) {
                    this.error(`Unknown function "${fnName}"`, node);
                }

                const sig = this.externalSignatures[fnName];
                if (sig) {
                    if (node.arguments.length !== sig.params.length) {
                        this.error(`Invalid argument count for "${fnName}": expected ${sig.params.length}, got ${node.arguments.length}`, node);
                    }
                    node.arguments.forEach((arg, i) => {
                        const t = this.visit(arg);
                        if (sig.params[i] !== "any" && t !== sig.params[i] && t !== "unknown") {
                            this.error(`Argument ${i + 1} of "${fnName}" must be ${sig.params[i]}, got ${t}`, node);
                        }
                    });
                    if (fnName === "AI") return this.Prob(sig.returns);
                    return sig.returns;
                }

                node.arguments.forEach(a => this.visit(a));
                return "unknown";
            }

            case "ArrowFunction":
                this.enterScope();
                node.params.forEach(p => this.declare(p.name, p.typeAnnotation ?? "unknown"));
                this.visit(node.body);
                this.exitScope();
                return "function";

            default:
                break;
        }
        return null;
    }

    analyzeBranch(node) {
        if (!node) return null;
        if (node.type === "BlockStatement") {
            let returnType = null;
            this.enterScope();
            for (const stmt of node.body) {
                if (stmt.type === "ReturnStatement") {
                    const t = this.visit(stmt);
                    if (!returnType) returnType = t;
                    else if (returnType !== t) this.error(`Inconsistent return types: ${returnType} vs ${t}`, node);
                } else {
                    this.visit(stmt);
                }
            }
            this.exitScope();
            return returnType;
        }
        if (node.type === "IfStatement") return this.visit(node);
        return this.visit(node);
    }

    error(message, node) {
        throw new Diagnostic(message, node, this.source);
    }
}
