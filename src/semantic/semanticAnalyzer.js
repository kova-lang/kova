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
    isProb(t) { return t !== null && typeof t === "object" && t.kind === "prob"; }
    unwrapProb(t) { return t.inner; }

    // #### Scope helpers ####
    enterScope() { this.scopes.push(new Map()); }
    exitScope() { this.scopes.pop(); }

    // Declare a variable in the current scope with a given type
    declare(name, type) {
        const scope = this.scopes[this.scopes.length - 1];
        if (scope.has(name)) throw new Error(`Variable "${name}" already declared in this scope`);
        scope.set(name, type);
    }
    //  Resolve a variable name to its type, checking all scopes and externals
    resolve(name, node = null) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) return this.scopes[i].get(name);
        }
        if (Object.prototype.hasOwnProperty.call(this.externals, name)) return "external";
        if (this.functions[name]) return "function";
        throw new Diagnostic(`Undeclared variable "${name}"`, node, this.source);
    }
    // #### Main analysis method ####
    analyze(ast) {
        this.enterScope();
        this.visit(ast);
        this.exitScope();
    }

    // Visit the program node, basically an array of statements. The initial scope initiator.
    visitProgram(node) {
        node.body.forEach(s => this.visit(s));
        return null;
    }

    // Env exp only return the object type
    visitEnvExpression(_node) { return "object"; }

    // Scan through the array for its elements and return an array type
    visitArrayExpression(node) {
        node.elements.forEach(el => this.visit(el));
        return "array";
    }

    // Scan through an object properties, an array objects 
    visitObjectExpression(node) {
        node.properties.forEach(p => this.visit(p.value));
        return "object";
    }

    // member expressions 
    visitMemberExpression(node) {
        const objType = this.visit(node.object);
        if (!["object", "array", "string", "external", "unknown"].includes(objType))
            this.error(`Cannot access property on type "${objType}"`, node);
        return "unknown";
    }

    // {... statements} scan
    visitBlockStatement(node) {
        this.enterScope();
        node.body.forEach(s => this.visit(s));
        this.exitScope();
        return null;
    }

    visitReturnStatement(node) {
        const t = this.visit(node.argument);
        this.currentReturnType = t;
        return t;
    }

    visitExpressionStatement(node) {
        return this.visit(node.expression);
    }
    // visit() delegates to them
    visitIdentifier(node) {
        return this.resolve(node.name, node);
    }

    visitLiteral(node) {
        return node.value === null ? "null" : typeof node.value;
    }
    // visit binary operation num op num --- with special case for concatenation: 
    visitBinaryExpression(node) {
        const L = this.visit(node.left);
        const R = this.visit(node.right);
        const op = node.operator;

        if (this.isProb(L) || this.isProb(R))
            this.error("Probabilistic values must be resolved before use", node);

        if (["+", "-", "*", "/", "%"].includes(op)) {
            if (op === "+" && L === "string" && R === "string") return "string";
            if (L !== "unknown" && R !== "unknown" && (L !== "number" || R !== "number"))
                this.error(`Arithmetic operators require numbers, got ${L} and ${R}`, node);
            return "number";
        }
        if ([">", "<", ">=", "<="].includes(op)) {
            if (L !== "unknown" && R !== "unknown" && (L !== "number" || R !== "number"))
                this.error("Comparison operators require numbers", node);
            return "boolean";
        }
        if (["==", "!="].includes(op)) {
            if (L !== R && L !== "unknown" && R !== "unknown")
                this.error(`Equality operands must be the same type, got ${L} and ${R}`, node);
            return "boolean";
        }
        if (["&&", "||"].includes(op)) {
            if ((L !== "boolean" && L !== "unknown") || (R !== "boolean" && R !== "unknown"))
            this.error("Logical operators require booleans", node);
            return "boolean";
        }
        this.error(`Unknown operator "${op}"`, node);
    }
    // visit unary expression
    visitUnaryExpression(node) {
        const argType = this.visit(node.argument);
        if (this.isProb(argType))
            this.error("Probabilistic values must be resolved before use", node);
        
        if (node.operator === "-") {
            if (argType !== "number" && argType !== "unknown")
                this.error("Unary '-' requires a number", node);
            return "number";
        }
        if (node.operator === "!") {
            if (argType !== "boolean" && argType !== "unknown")
                this.error("Unary '!' requires a boolean", node);
            return "boolean";
        }
        this.error(`Unknown unary operator "${node.operator}"`, node);
    }
    // visit the variable declaration node and check if it already declared and decide to save or not.
    visitVariableDeclaration(node) {
        this.declare(node.id.name, "unknown");
        const t = this.visit(node.init);
        if (node.typeAnnotation && t !== node.typeAnnotation && t !== "unknown")
            this.error(`Type mismatch: declared ${node.typeAnnotation} but got ${t}`, node);
        this.scopes[this.scopes.length - 1].set(node.id.name, t);
        return t;
    }

    // scans the tree
    visitAssignmentExpression(node) {
        this.visit(node.left);
        this.visit(node.right);
        return "unknown";
    }

    // Function declarations
    visitFunctionDeclaration(node) {
        this.functions[node.name.name] = node.returnType ?? "unknown";
        this.declare(node.name.name, "function");
        this.enterScope();
        node.params.forEach(p => this.declare(p.name, p.typeAnnotation ?? "unknown"));
        const prevReturn = this.currentReturnType;
        this.currentReturnType = null;
        node.body.body.forEach(s => this.visit(s));
        if (node.returnType && this.currentReturnType && node.returnType !== this.currentReturnType)
            this.error(`Function "${node.name.name}" declared return type ${node.returnType} but returns ${this.currentReturnType}`, node);
        this.currentReturnType = prevReturn;
        this.exitScope();
        return "function";
    }

    visitArrowFunction(node) {
        this.enterScope();
        node.params.forEach(p => this.declare(p.name, p.typeAnnotation ?? "unknown"));
        this.visit(node.body);
        this.exitScope();
        return "function";
    }

    // complex 4-sub-cases function call expressions
    visitCallExpression(node) {

        // for member expressions like foo.name()
        if (node.callee.type === "MemberExpression") {
            this.visit(node.callee.object);
            if (node.callee.computed) this.visit(node.callee.property);
            node.arguments.forEach(a => this.visit(a));
            return "unknown";
        }

        // for non-identifier callees like immediately-invoked arrow functions
        if (node.callee.type !== "Identifier") {
            this.visit(node.callee);
            node.arguments.forEach(a => this.visit(a));
            return "unknown";
        }

        const fnName = node.callee.name;

        // Special function to resolve prob type calls
        if (fnName === "resolve") {
            if (node.arguments.length !== 1)
                this.error("resolve() takes exactly one argument", node);
            const argType = this.visit(node.arguments[0]);
            if (!this.isProb(argType))
                this.error("resolve() expects a probabilistic value", node);
            return this.unwrapProb(argType);
        }
        // Kova built-in functions
        const BUILTINS = {
            print: "null", len: "number", push: "null", pop: "unknown",
            keys: "array", values: "array", toString: "string",
            toNumber: "number", typeOf: "string", range: "array", resolve: "unknown"
        };
        if (Object.prototype.hasOwnProperty.call(BUILTINS, fnName)) {
            node.arguments.forEach(a => this.visit(a));
            return BUILTINS[fnName];
        }

        if (this.functions[fnName]) {
            node.arguments.forEach(a => this.visit(a));
            return this.functions[fnName];
        }

        // If you call function not also in the externals, then the function  was never declared
        if (!Object.prototype.hasOwnProperty.call(this.externals, fnName))
            this.error(`Unknown function "${fnName}"`, node);

        const sig = this.externalSignatures[fnName];
        if (sig) {
            if (node.arguments.length !== sig.params.length)
                this.error(`Invalid argument count for "${fnName}": expected ${sig.params.length}, got ${node.arguments.length}`, node);
            node.arguments.forEach((arg, i) => {
                const t = this.visit(arg);
                if (sig.params[i] !== "any" && t !== sig.params[i] && t !== "unknown")
                    this.error(`Argument ${i + 1} of "${fnName}" must be ${sig.params[i]}, got ${t}`, node);
            });
            if (fnName === "AI") return this.Prob(sig.returns);
            return sig.returns;
        }

        node.arguments.forEach(a => this.visit(a));
        return "unknown";
    }
    //  Analyze a branch of an if-statement, which could be either a block or a single statement. Return the type of any return statement found.
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
    }
    // scan the if statements and the return types matches
    visitIfStatement(node) {
        const testType = this.visit(node.test);
        if (this.isProb(testType))
            this.error("Probabilistic value cannot be used in 'if' condition. Use resolve().", node.test);
        if (testType !== "boolean" && testType !== "unknown")
            this.error(`If condition must be boolean, got "${testType}"`, node);
        const consReturn = this.analyzeBranch(node.consequent);
        const altReturn = node.alternate ? this.analyzeBranch(node.alternate) : null;
        if (consReturn && altReturn && consReturn !== altReturn)
            this.error(`Mismatched return types: ${consReturn} vs ${altReturn}`, node);
        return consReturn ?? altReturn ?? null;
    }

    visitWhileStatement(node) {
        const testType = this.visit(node.test);
        if (testType !== "boolean" && testType !== "unknown")
            this.error(`While condition must be boolean, got "${testType}"`, node);
        this.enterScope();
        node.body.body.forEach(s => this.visit(s));
        this.exitScope();
        return null;
    }

    visitForStatement(node) {
        this.enterScope();
        const iterType = this.visit(node.iterable);
        if (iterType !== "array" && iterType !== "unknown")
            this.error(`For..in requires an array, got "${iterType}"`, node);
        this.declare(node.id.name, "unknown");
        node.body.body.forEach(s => this.visit(s));
        this.exitScope();
        return null;
    }

    visitHttpStatement(node) {
        this.visit(node.url);
        if (node.body) this.visit(node.body);
        if (node.headers) this.visit(node.headers);
        if (node.binding) {
            try { this.declare(node.binding.name, "object"); } catch (_) { }
        }
        return null;
    }

    visitHttpExpression(node) {
        this.visit(node.url);
        if (node.body) this.visit(node.body);
        if (node.headers) this.visit(node.headers);
        return "object";
    }

    visitRespondStatement(node) {
        this.visit(node.value);
        return null;
    }
    visitConnectStatement(node) {
        this.visit(node.config);
        if (node.binding) {
            try { this.declare(node.binding.name, "object"); } catch (_) { }
        }
        try { this.declare(node.driver, "object"); } catch (_) { }
        return "object";
    }

    visitFindStatement(node) {
        if (node.filter) this.visit(node.filter);
        if (node.limit) this.visit(node.limit);
        if (node.binding) {
            try { this.declare(node.binding.name, "array"); } catch (_) { }
        }
        return "array";
    }

    visitInsertStatement(node) {
        this.visit(node.document);
        if (node.binding) {
            try { this.declare(node.binding.name, "object"); } catch (_) { }
        }
        return "object";
    }

    visitUpdateStatement(node) {
        this.visit(node.updates);
        if (node.filter) this.visit(node.filter);
        if (node.binding) {
            try { this.declare(node.binding.name, "object"); } catch (_) { }
        }
        return "object";
    }
    visitImportStatement(node) {
        node.specifiers.forEach(spec => {
            try { this.declare(spec, "unknown"); } catch (_) { }
        });
        if (node.defaultImport) {
            try { this.declare(node.defaultImport, "unknown"); } catch (_) { }
        }
        return null;
    }

    visitExportStatement(node) {
        return this.visit(node.declaration);
    }
    // Recursively visit AST nodes and perform type-checking and semantic analysis
    visit(node) {
        if (!node) return null;

        switch (node.type) {

            case "Program": return this.visitProgram(node);

            case "VariableDeclaration": return this.visitVariableDeclaration(node);

            case "FunctionDeclaration": return this.visitFunctionDeclaration(node);

            case "Identifier": return this.visitIdentifier(node);

            case "Literal": return this.visitLiteral(node);

            case "EnvExpression": return this.visitEnvExpression(node); // process.env is an object

            case "ArrayExpression": return this.visitArrayExpression(node);

            case "ObjectExpression": return this.visitObjectExpression(node);

            case "MemberExpression": return this.visitMemberExpression(node);

            case "BinaryExpression": return this.visitBinaryExpression(node);

            case "UnaryExpression": return this.visitUnaryExpression(node);


            case "IfStatement": return this.visitIfStatement(node);

            case "WhileStatement": return this.visitWhileStatement(node);

            case "ForStatement": return this.visitForStatement(node);

            case "BlockStatement": return this.visitBlockStatement(node);

            case "ReturnStatement": return this.visitReturnStatement(node);

            case "AssignmentExpression": return this.visitAssignmentExpression(node);

            case "ExpressionStatement": return this.visitExpressionStatement(node);

            // #### HTTP ####
            case "HttpStatement": return this.visitHttpStatement(node);

            case "HttpExpression": return this.visitHttpExpression(node);

            // #### HTTP - respond ####
            case "RespondStatement": return this.visitRespondStatement(node);

            // #### DB Statements ####
            case "ConnectStatement": return this.visitConnectStatement(node);

            case "FindStatement": return this.visitFindStatement(node);

            case "InsertStatement": return this.visitInsertStatement(node);

            case "UpdateStatement": return this.visitUpdateStatement(node);

            // #### Imports && Exports ####
            case "ImportStatement": return this.visitImportStatement(node);
            case "ExportStatement": return this.visitExportStatement(node);

            // #### Functions ####
            case "CallExpression": return this.visitCallExpression(node);

            case "ArrowFunction": return this.visitArrowFunction(node);

            default:
                break;
        }
        return null;
    }


    error(message, node) {
        throw new Diagnostic(message, node, this.source);
    }
}
