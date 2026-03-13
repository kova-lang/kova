/**
 * ExecutionGraph
 *
 * Converts a Kova AST into an explicit directed graph where:
 *   - Every meaningful statement/expression is a NODE
 *   - Every data dependency or control dependency is an EDGE
 *
 * Node kinds:
 *   entry        — program start
 *   exit         — program end
 *   declare      — variable declaration  (let x = ...)
 *   assign       — variable reassignment
 *   http         — HTTP call             (GET / POST / PUT / DELETE / PATCH)
 *   db_connect   — database connection   (connect ... using ...)
 *   db_find      — DB read query         (find ... where ...)
 *   db_insert    — DB write              (insert into ...)
 *   db_update    — DB mutation           (update ... set ...)
 *   respond      — respond statement
 *   call         — function call
 *   fn_def       — function declaration
 *   if           — conditional branch
 *   while        — while loop
 *   for          — for..in loop
 *   return       — return statement
 *   import       — import statement
 *   expr         — generic expression
 *
 * Edge kinds:
 *   seq          — sequential execution (A then B)
 *   data         — data dependency (B reads a value produced by A)
 *   control      — control dependency (B runs only if A's condition is true/false)
 *   call         — function invocation edge
 *   binding      — result binding (into <var>)
 */

export class ExecutionGraph {
    constructor() {
        this.nodes = new Map();   // id → GraphNode
        this.edges = [];          // GraphEdge[]
        this._counter = 0;
        this._varProducers = new Map(); // varName → nodeId (last writer)
        this._fnNodes = new Map();      // fnName → nodeId
    }

    // ─── Node / Edge factories ────────────────────────────────────────────────

    _id() { return `n${++this._counter}`; }

    addNode(kind, label, meta = {}) {
        const id = this._id();
        const node = { id, kind, label, meta, line: meta.line ?? null };
        this.nodes.set(id, node);
        return id;
    }

    addEdge(from, to, kind = "seq", label = "") {
        if (from && to && from !== to) {
            this.edges.push({ from, to, kind, label });
        }
    }

    // #### Variable tracking ####

    _setProducer(name, nodeId) { this._varProducers.set(name, nodeId); }

    _getProducer(name) { return this._varProducers.get(name) ?? null; }

    // Collect all identifier names referenced in an AST node (shallow)
    _refsIn(node) {
        const names = new Set();
        const walk = (n) => {
            if (!n || typeof n !== "object") return;
            if (n.type === "Identifier") names.add(n.name);
            if (n.type === "MemberExpression") walk(n.object);
            if (n.left)      walk(n.left);
            if (n.right)     walk(n.right);
            if (n.argument)  walk(n.argument);
            if (n.init)      walk(n.init);
            if (n.test)      walk(n.test);
            if (n.url)       walk(n.url);
            if (n.body && Array.isArray(n.body)) n.body.forEach(walk);
            if (n.arguments) n.arguments.forEach(walk);
            if (n.elements)  n.elements.forEach(walk);
            if (n.properties) n.properties.forEach(p => walk(p.value));
        };
        walk(node);
        return names;
    }

    // Add data-dependency edges from all vars referenced in `astNode` → `nodeId`
    _dataDeps(astNode, nodeId) {
        this._refsIn(astNode).forEach(name => {
            const producer = this._getProducer(name);
            if (producer) this.addEdge(producer, nodeId, "data", name);
        });
    }

    // #### Build ####

    build(ast) {
        const entryId = this.addNode("entry", "START", {});
        const exitId  = this.addNode("exit",  "END",   {});

        const lastId = this._visitProgram(ast.body, entryId);
        this.addEdge(lastId, exitId, "seq");

        return { nodes: this.nodes, edges: this.edges, entryId, exitId };
    }

    // Visit a list of statements, chaining them sequentially.
    // Returns the id of the last node produced.
    _visitProgram(stmts, prevId) {
        let last = prevId;
        for (const stmt of stmts) {
            const next = this._visitStmt(stmt, last);
            if (next) last = next;
        }
        return last;
    }

    _visitStmt(node, prevId) {
        if (!node) return prevId;

        switch (node.type) {

            case "VariableDeclaration": {
                // If the init is an AI() or resolve() call, give it its own node first
                if (node.init?.type === "CallExpression") {
                    const callId = this._visitCall(node.init, prevId, node.line);
                    const label = `let ${node.id.name}`;
                    const id = this.addNode("declare", label, { varName: node.id.name, line: node.line });
                    this.addEdge(callId, id, "binding", node.id.name);
                    this._setProducer(node.id.name, id);
                    return id;
                }
                const label = `let ${node.id.name}`;
                const id = this.addNode("declare", label, { varName: node.id.name, line: node.line });
                this.addEdge(prevId, id, "seq");
                this._dataDeps(node.init, id);
                this._setProducer(node.id.name, id);
                return id;
            }

            case "AssignmentExpression":
            case "ExpressionStatement": {
                const inner = node.type === "ExpressionStatement" ? node.expression : node;
                if (inner.type === "AssignmentExpression") {
                    const varName = inner.left?.name ?? inner.left?.property ?? "?";
                    const id = this.addNode("assign", `${varName} = ...`, { line: node.line });
                    this.addEdge(prevId, id, "seq");
                    this._dataDeps(inner.right, id);
                    if (inner.left?.name) this._setProducer(inner.left.name, id);
                    return id;
                }
                if (inner.type === "CallExpression") {
                    return this._visitCall(inner, prevId, node.line);
                }
                const id = this.addNode("expr", this._exprLabel(inner), { line: node.line });
                this.addEdge(prevId, id, "seq");
                this._dataDeps(inner, id);
                return id;
            }

            case "HttpStatement": {
                const method = node.method.replace("_HTTP", "");
                const urlStr = node.url?.value ?? node.url?.name ?? "...";
                const label  = `${method} "${urlStr}"${node.binding ? `\n→ ${node.binding.name}` : ""}`;
                const id = this.addNode("http", label, {
                    method, url: urlStr,
                    binding: node.binding?.name ?? null,
                    line: node.line,
                });
                this.addEdge(prevId, id, "seq");
                this._dataDeps(node.url, id);
                if (node.body) this._dataDeps(node.body, id);
                if (node.binding) this._setProducer(node.binding.name, id);
                return id;
            }

            case "ConnectStatement": {
                const id = this.addNode("db_connect",
                    `connect ${node.driver}${node.binding ? `\n→ ${node.binding.name}` : ""}`,
                    { driver: node.driver, line: node.line }
                );
                this.addEdge(prevId, id, "seq");
                this._dataDeps(node.config, id);
                if (node.binding) this._setProducer(node.binding.name, id);
                this._setProducer(node.driver, id);
                return id;
            }

            case "FindStatement": {
                const label = `find ${node.collection}${node.filter ? " where {...}" : ""}${node.limit ? ` limit ${node.limit?.value ?? "n"}` : ""}${node.binding ? `\n→ ${node.binding.name}` : ""}`;
                const id = this.addNode("db_find", label, {
                    collection: node.collection,
                    binding: node.binding?.name ?? null,
                    line: node.line,
                });
                this.addEdge(prevId, id, "seq");
                if (node.filter) this._dataDeps(node.filter, id);
                if (node.binding) this._setProducer(node.binding.name, id);
                return id;
            }

            case "InsertStatement": {
                const label = `insert into ${node.collection}${node.binding ? `\n→ ${node.binding.name}` : ""}`;
                const id = this.addNode("db_insert", label, {
                    collection: node.collection,
                    binding: node.binding?.name ?? null,
                    line: node.line,
                });
                this.addEdge(prevId, id, "seq");
                this._dataDeps(node.document, id);
                if (node.binding) this._setProducer(node.binding.name, id);
                return id;
            }

            case "UpdateStatement": {
                const label = `update ${node.collection} set {...}${node.binding ? `\n→ ${node.binding.name}` : ""}`;
                const id = this.addNode("db_update", label, {
                    collection: node.collection,
                    binding: node.binding?.name ?? null,
                    line: node.line,
                });
                this.addEdge(prevId, id, "seq");
                this._dataDeps(node.updates, id);
                if (node.filter) this._dataDeps(node.filter, id);
                if (node.binding) this._setProducer(node.binding.name, id);
                return id;
            }

            case "RespondStatement": {
                const id = this.addNode("respond", "respond {...}", { line: node.line });
                this.addEdge(prevId, id, "seq");
                this._dataDeps(node.value, id);
                return id;
            }

            case "ReturnStatement": {
                const id = this.addNode("return", "return", { line: node.line });
                this.addEdge(prevId, id, "seq");
                this._dataDeps(node.argument, id);
                return id;
            }

            case "FunctionDeclaration": {
                const id = this.addNode("fn_def", `fn ${node.name.name}(${node.params.map(p => p.name).join(", ")})`, {
                    fnName: node.name.name,
                    params: node.params.map(p => p.name),
                    line: node.line,
                });
                this.addEdge(prevId, id, "seq");
                this._fnNodes.set(node.name.name, id);
                this._setProducer(node.name.name, id);

                // Visit the function body as a subgraph, branching from the fn_def node
                const bodyEntry = this.addNode("entry", `${node.name.name}: entry`, { line: node.line });
                this.addEdge(id, bodyEntry, "call", "body");
                this._visitProgram(node.body.body, bodyEntry);
                return id;
            }

            case "IfStatement": {
                const testLabel = this._exprLabel(node.test);
                const id = this.addNode("if", `if ${testLabel}`, { line: node.line });
                this.addEdge(prevId, id, "seq");
                this._dataDeps(node.test, id);

                // Consequent branch
                const thenEntry = this.addNode("entry", "then", { line: node.line });
                this.addEdge(id, thenEntry, "control", "true");
                const thenExit = this._visitProgram(node.consequent.body, thenEntry);

                // Alternate branch
                let elseExit = null;
                if (node.alternate) {
                    const elseEntry = this.addNode("entry", "else", { line: node.line });
                    this.addEdge(id, elseEntry, "control", "false");
                    const altBody = node.alternate.type === "BlockStatement"
                        ? node.alternate.body
                        : [node.alternate];
                    elseExit = this._visitProgram(altBody, elseEntry);
                }

                // Merge point
                const mergeId = this.addNode("entry", "merge", { line: node.line });
                this.addEdge(thenExit, mergeId, "seq");
                if (elseExit) this.addEdge(elseExit, mergeId, "seq");
                else this.addEdge(id, mergeId, "control", "false");
                return mergeId;
            }

            case "WhileStatement": {
                const testLabel = this._exprLabel(node.test);
                const id = this.addNode("while", `while ${testLabel}`, { line: node.line });
                this.addEdge(prevId, id, "seq");
                this._dataDeps(node.test, id);

                const bodyEntry = this.addNode("entry", "loop body", {});
                this.addEdge(id, bodyEntry, "control", "true");
                const bodyExit = this._visitProgram(node.body.body, bodyEntry);
                this.addEdge(bodyExit, id, "seq"); // loop back

                const loopExit = this.addNode("entry", "loop exit", {});
                this.addEdge(id, loopExit, "control", "false");
                return loopExit;
            }

            case "ForStatement": {
                const id = this.addNode("for", `for ${node.id.name} in ...`, { line: node.line });
                this.addEdge(prevId, id, "seq");
                this._dataDeps(node.iterable, id);

                const bodyEntry = this.addNode("entry", "loop body", {});
                this.addEdge(id, bodyEntry, "control", "iter");
                this._setProducer(node.id.name, bodyEntry);
                const bodyExit = this._visitProgram(node.body.body, bodyEntry);
                this.addEdge(bodyExit, id, "seq"); // loop back

                const loopExit = this.addNode("entry", "loop exit", {});
                this.addEdge(id, loopExit, "control", "done");
                return loopExit;
            }

            case "ImportStatement": {
                const what = node.defaultImport ?? node.specifiers.join(", ");
                const id = this.addNode("import", `import ${what}\nfrom "${node.source}"`, { line: node.line });
                this.addEdge(prevId, id, "seq");
                node.specifiers.forEach(s => this._setProducer(s, id));
                if (node.defaultImport) this._setProducer(node.defaultImport, id);
                return id;
            }

            case "BlockStatement":
                return this._visitProgram(node.body, prevId);

            default:
                return prevId;
        }
    }

    _visitCall(node, prevId, line) {
        const fnName = node.callee?.name ?? node.callee?.property ?? "fn";
        const kind = fnName === "AI" ? "ai" : fnName === "resolve" ? "resolve_prob" : "call";
        const id = this.addNode(kind, `${fnName}(...)`, { fnName, line });
        this.addEdge(prevId, id, "seq");
        node.arguments?.forEach(a => this._dataDeps(a, id));

        // If it's a known user function, draw a call edge to its definition
        const fnDefId = this._fnNodes.get(fnName);
        if (fnDefId) this.addEdge(id, fnDefId, "call", fnName);

        return id;
    }

    _exprLabel(node) {
        if (!node) return "?";
        switch (node.type) {
            case "Literal":           return JSON.stringify(node.value);
            case "Identifier":        return node.name;
            case "BinaryExpression":  return `${this._exprLabel(node.left)} ${node.operator} ${this._exprLabel(node.right)}`;
            case "UnaryExpression":   return `${node.operator}${this._exprLabel(node.argument)}`;
            case "MemberExpression":  return `${this._exprLabel(node.object)}.${node.property}`;
            case "CallExpression":    return `${this._exprLabel(node.callee)}(...)`;
            default:                  return node.type.replace("Expression", "").toLowerCase();
        }
    }

    // #### Serialise to plain JSON (for visualizer / external tools) ####

    toJSON() {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges,
        };
    }

    // #### Analysis helpers (useful for research presentation) ####

    /**
     * Returns nodes that have no incoming data edges — "root" producers.
     * These are variables / operations that depend on nothing else.
     */
    sourceNodes() {
        const hasIncoming = new Set(this.edges.filter(e => e.kind === "data").map(e => e.to));
        return Array.from(this.nodes.values()).filter(n =>
            n.kind !== "entry" && n.kind !== "exit" && !hasIncoming.has(n.id)
        );
    }

    /**
     * Returns pairs of nodes that could theoretically execute in parallel
     * because they share no data dependency path between them.
     */
    parallelCandidates() {
        // Build adjacency for data deps only
        const depends = new Map(); // nodeId → Set of transitive dependencies
        const dataEdges = this.edges.filter(e => e.kind === "data");

        const getDeps = (id, visited = new Set()) => {
            if (visited.has(id)) return visited;
            visited.add(id);
            dataEdges.filter(e => e.to === id).forEach(e => getDeps(e.from, visited));
            return visited;
        };

        const candidates = [];
        const nodeList = Array.from(this.nodes.values()).filter(n =>
            !["entry", "exit"].includes(n.kind)
        );

        for (let i = 0; i < nodeList.length; i++) {
            for (let j = i + 1; j < nodeList.length; j++) {
                const a = nodeList[i], b = nodeList[j];
                const depsA = getDeps(a.id);
                const depsB = getDeps(b.id);
                if (!depsA.has(b.id) && !depsB.has(a.id)) {
                    candidates.push([a.id, b.id]);
                }
            }
        }
        return candidates;
    }

    /**
     * Topological sort of nodes (sequential + data edges only).
     * Returns an ordered array of node ids representing a valid execution order.
     */
    topologicalOrder() {
        const inDegree = new Map();
        const adj = new Map();
        this.nodes.forEach((_, id) => { inDegree.set(id, 0); adj.set(id, []); });

        this.edges
            .filter(e => e.kind === "seq" || e.kind === "data")
            .forEach(e => {
                adj.get(e.from)?.push(e.to);
                inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
            });

        const queue = [];
        inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });

        const order = [];
        while (queue.length) {
            const id = queue.shift();
            order.push(id);
            adj.get(id)?.forEach(next => {
                inDegree.set(next, inDegree.get(next) - 1);
                if (inDegree.get(next) === 0) queue.push(next);
            });
        }

        return order;
    }
}

/**
 * Build an execution graph from a Kova AST.
 * Convenience wrapper used by runKova and the visualizer.
 */
export function buildGraph(ast) {
    const g = new ExecutionGraph();
    const graph = g.build(ast);
    return { graph, graphInstance: g };
}
