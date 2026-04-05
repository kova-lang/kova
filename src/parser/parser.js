import { assignOps, CONTEXTUAL_KW_TYPES, HTTP, LITERAL_TYPES } from "../../lib/constants/store.js";

export default class Parser {
    constructor() {
        this.tokens = [];
        this.currentPos = 0;
        this.currentToken = null;
    }

    advance() {
        this.currentPos++;
        this.currentToken =
            this.currentPos < this.tokens.length
                ? this.tokens[this.currentPos]
                : { type: "EOF" };
        return this.currentToken;
    }

    peek(offset = 1) {
        const pos = this.currentPos + offset;
        return pos < this.tokens.length ? this.tokens[pos] : { type: "EOF" };
    }

    expect(type) {
        if (!this.currentToken || this.currentToken.type !== type) {
            const loc = this.currentToken?.line != null
                ? ` at line ${this.currentToken.line}, col ${this.currentToken.column}`
                : "";
            throw new Error(
                `Expected ${type} but got ${this.currentToken?.type ?? "null"}${loc}`
            );
        }
        const tok = this.currentToken;
        this.advance();
        return tok;
    }

    makeBinary(op, left, right) {
        return {
            type: "BinaryExpression",
            operator: op.value,
            left,
            right,
            line: op.line,
            column: op.column,
        };
    }

    // #### Program structure ####
    parseProgram(tokens) {
        this.tokens = tokens;
        this.currentPos = 0;
        this.currentToken = this.tokens[0] ?? { type: "EOF" };
        const body = [];
        while (this.currentToken.type !== "EOF") {
            body.push(this.parseStatement());
        }
        return { type: "Program", body };
    }

    // #### Statements ####

    parseStatement() {
        while (this.currentToken.type === "SEMICOLON") this.advance();

        switch (this.currentToken.type) {
            case "LET": return this.parseVariableDeclaration();
            case "FN": return this.parseFunctionDeclaration();
            case "IF": return this.parseIfStatement();
            case "WHILE": return this.parseWhileStatement();
            case "FOR": return this.parseForStatement();
            case "RETURN": return this.parseReturnStatement();
            case "RESPOND": return this.parseRespondStatement();
            case "IMPORT": return this.parseImportStatement();
            case "EXPORT": return this.parseExportStatement();
            case "CONNECT": return this.parseConnectStatement();
            case "FIND": return this.parseFindStatement();
            case "INSERT": return this.parseInsertStatement();
            case "UPDATE": return this.parseUpdateStatement();
            case "POST_HTTP":
            case "GET_HTTP":
            case "PUT_HTTP":
            case "PATCH_HTTP":
            case "DELETE_HTTP": return this.parseHttpStatement();
            case "LBRACE": return this.parseBlock();
            default: return this.parseExpressionStatement();
        }
    }

    // #### Variable / Function declarations ####

    parseVariableDeclaration() {
        const letToken = this.currentToken;
        this.expect("LET");

        const id = this.currentToken;
        this.expect("IDENTIFIER");

        // optional type annotation:  let x: number = 5
        let typeAnnotation = null;
        if (this.currentToken.type === "COLON") {
            this.advance();
            typeAnnotation = this.currentToken.value;
            this.advance();
        }

        this.expect("ASSIGN");
        const init = this.parseExpression();

        return {
            type: "VariableDeclaration",
            id: { type: "Identifier", name: id.value, line: id.line, column: id.column },
            typeAnnotation,
            init,
            line: letToken.line,
            column: letToken.column,
        };
    }

    // function declaration:  fn name(params) { ... }
    parseFunctionDeclaration() {
        const fnToken = this.currentToken;
        this.expect("FN");

        const name = this.currentToken;
        this.expect("IDENTIFIER");
        this.expect("LPAREN");

        const params = [];
        if (this.currentToken.type !== "RPAREN") {
            params.push(this.parseParam());
            while (this.currentToken.type === "COMMA") {
                this.advance();
                params.push(this.parseParam());
            }
        }
        this.expect("RPAREN");

        // optional return type:  fn greet(name: string): string { ... }
        let returnType = null;
        if (this.currentToken.type === "COLON") {
            this.advance();
            returnType = this.currentToken.value;
            this.advance();
        }

        const body = this.parseBlock();

        return {
            type: "FunctionDeclaration",
            name: { type: "Identifier", name: name.value, line: name.line, column: name.column },
            params,
            returnType,
            body,
            line: fnToken.line,
            column: fnToken.column,
        };
    }

    // function parameter:  name: typeAnnotation?
    parseParam() {
        const name = this.currentToken;
        this.expect("IDENTIFIER");
        let typeAnnotation = null;
        if (this.currentToken.type === "COLON") {
            this.advance();
            typeAnnotation = this.currentToken.value;
            this.advance();
        }
        return {
            type: "Param",
            name: name.value,
            typeAnnotation,
            line: name.line,
            column: name.column,
        };
    }

    // #### Control flow ####
    parseIfStatement() {
        const ifToken = this.currentToken;
        this.expect("IF");
        const test = this.parseExpression();
        const consequent = this.parseBlock();
        let alternate = null;
        if (this.currentToken.type === "ELSE") {
            this.advance();
            alternate = this.currentToken.type === "IF"
                ? this.parseIfStatement()
                : this.parseBlock();
        }
        return { type: "IfStatement", test, consequent, alternate, line: ifToken.line, column: ifToken.column };
    }

    // while (test) { body }
    parseWhileStatement() {
        const tok = this.currentToken;
        this.expect("WHILE");
        const test = this.parseExpression();
        const body = this.parseBlock();
        return { type: "WhileStatement", test, body, line: tok.line, column: tok.column };
    }

    // for id in iterable { body }
    parseForStatement() {
        const tok = this.currentToken;
        this.expect("FOR");
        const id = this.currentToken;
        this.expect("IDENTIFIER");
        this.expect("IN");
        const iterable = this.parseExpression();
        const body = this.parseBlock();
        return {
            type: "ForStatement",
            id: { type: "Identifier", name: id.value, line: id.line, column: id.column },
            iterable,
            body,
            line: tok.line,
            column: tok.column,
        };
    }

    // #### HTTP statements ####
    //
    //  GET  "url"                          → plain request, result discarded
    //  GET  "url"  into result             → bind response to let 'result'
    //  POST "url"  save body               → send body, discard response
    //  POST "url"  save body  into result  → send body, bind response
    //  PUT  "url"  save body  into result
    //  DELETE "url"
    //  PATCH "url" save body
    //  Any HTTP verb can also have:  headers { key: val }

    parseHttpStatement() {
        const verb = this.currentToken;
        this.advance();

        // URL – string literal or expression
        const url = this.parseSimpleExpression();

        // optional body:  save <expr>
        let body = null;
        if (this.currentToken.type === "SAVE") {
            this.advance();
            body = this.parseSimpleExpression();
        }

        // optional headers:  headers { ... }
        let headers = null;
        if (this.currentToken.type === "IDENTIFIER" && this.currentToken.value === "headers") {
            this.advance();
            headers = this.parseObjectExpression();
        }

        // optional result binding:  into <identifier>
        let binding = null;
        if (this.currentToken.type === "INTO") {
            this.advance();
            binding = this.currentToken;
            this.expect("IDENTIFIER");
        }

        return {
            type: "HttpStatement",
            method: verb.value,
            url,
            body,
            headers,
            binding: binding ? { type: "Identifier", name: binding.value, line: binding.line, column: binding.column } : null,
            line: verb.line,
            column: verb.column,
        };
    }

    // #### respond statement ####
    //
    //  respond { status: 200, body: data }
    //  respond data                         → shorthand, body only

    parseRespondStatement() {
        const tok = this.currentToken;
        this.expect("RESPOND");
        const value = this.parseExpression();
        return { type: "RespondStatement", value, line: tok.line, column: tok.column };
    }

    // #### CONNECT statement ####
    //
    //  connect mysql using {
    //      host: ENV.DB_HOST,
    //      user: ENV.DB_USER,
    //      password: ENV.DB_PASS,
    //      database: ENV.DB_NAME
    //  }
    //  The result is automatically stored in the named connection variable.

    parseConnectStatement() {
        const tok = this.currentToken;
        this.expect("CONNECT");

        // driver name: mysql | postgres | mongo | sqlite | redis ...
        const driver = this.currentToken;
        this.expect("IDENTIFIER");

        this.expect("USING");
        const config = this.parseObjectExpression();

        // optional:  into myConn
        let binding = null;
        if (this.currentToken.type === "INTO") {
            this.advance();
            binding = this.currentToken;
            this.expect("IDENTIFIER");
        }

        return {
            type: "ConnectStatement",
            driver: driver.value,
            config,
            binding: binding
                ? { type: "Identifier", name: binding.value, line: binding.line, column: binding.column }
                : null,
            line: tok.line,
            column: tok.column,
        };
    }

    // #### DB query statements ####
    //
    //  find users where { active: true } limit 10 order_by createdAt desc  into results
    //  insert into users { name: "Alice", email: "alice@x.com" }           into newDoc
    //  update users set { verified: true } where { id: userId }
    //  delete from users where { id: userId }   (uses DB_DELETE token, not HTTP DELETE)

    parseFindStatement() {
        const tok = this.currentToken;
        this.expect("FIND");

        const collection = this.currentToken;
        this.expect("IDENTIFIER");

        // optional  where { ... }
        let filter = null;
        if (this.currentToken.type === "WHERE") {
            this.advance();
            filter = this.parseObjectExpression();
        }

        // optional  limit <number | identifier>
        let limitVal = null;
        if (this.currentToken.type === "LIMIT") {
            this.advance();
            limitVal = this.parseSimpleExpression();
        }

        // optional  order_by <field> asc|desc
        let orderBy = null;
        if (this.currentToken.type === "ORDER_BY") {
            this.advance();
            const field = this.currentToken;
            this.expect("IDENTIFIER");
            const isDirectional = this.currentToken.type === "ASC" || this.currentToken.type === "DESC";
            const dir = isDirectional ? this.currentToken.value
                : "asc";
            if (isDirectional) this.advance();
            orderBy = { field: field.value, direction: dir };
        }

        // optional  into <identifier>
        let binding = null;
        if (this.currentToken.type === "INTO") {
            this.advance();
            binding = this.currentToken;
            this.expect("IDENTIFIER");
        }

        return {
            type: "FindStatement",
            collection: collection.value,
            filter,
            limit: limitVal,
            orderBy,
            binding: binding
                ? { type: "Identifier", name: binding.value, line: binding.line, column: binding.column }
                : null,
            line: tok.line,
            column: tok.column,
        };
    }

    parseInsertStatement() {
        const tok = this.currentToken;
        this.expect("INSERT");
        this.expect("INTO");

        const collection = this.currentToken;
        this.expect("IDENTIFIER");

        const document = this.parseObjectExpression();

        // optional  into <identifier>   (to capture inserted document / id)
        let binding = null;
        if (this.currentToken.type === "INTO") {
            this.advance();
            binding = this.currentToken;
            this.expect("IDENTIFIER");
        }

        return {
            type: "InsertStatement",
            collection: collection.value,
            document,
            binding: binding
                ? { type: "Identifier", name: binding.value, line: binding.line, column: binding.column }
                : null,
            line: tok.line,
            column: tok.column,
        };
    }

    parseUpdateStatement() {
        const tok = this.currentToken;
        this.expect("UPDATE");

        const collection = this.currentToken;
        this.expect("IDENTIFIER");

        this.expect("SET");
        const updates = this.parseObjectExpression();

        let filter = null;
        if (this.currentToken.type === "WHERE") {
            this.advance();
            filter = this.parseObjectExpression();
        }

        let binding = null;
        if (this.currentToken.type === "INTO") {
            this.advance();
            binding = this.currentToken;
            this.expect("IDENTIFIER");
        }

        return {
            type: "UpdateStatement",
            collection: collection.value,
            updates,
            filter,
            binding: binding
                ? { type: "Identifier", name: binding.value, line: binding.line, column: binding.column }
                : null,
            line: tok.line,
            column: tok.column,
        };
    }

    // #### Import / Export ####
    //
    //  import { handler, util } from "./routes/users"
    //  import logger from "./lib/logger"    (default import)

    parseImportStatement() {
        const tok = this.currentToken;
        this.expect("IMPORT");

        const specifiers = [];
        let defaultImport = null;

        if (this.currentToken.type === "LBRACE") {
            // named imports: { a, b }
            this.advance();
            while (this.currentToken.type !== "RBRACE" && this.currentToken.type !== "EOF") {
                const spec = this.currentToken;
                this.expect("IDENTIFIER");
                specifiers.push(spec.value);
                if (this.currentToken.type === "COMMA") this.advance();
            }
            this.expect("RBRACE");
        } else if (this.currentToken.type === "IDENTIFIER") {
            // default import:  import logger from "..."
            defaultImport = this.currentToken.value;
            this.advance();
        }

        this.expect("FROM");
        const source = this.currentToken;
        this.expect("STRING");

        return {
            type: "ImportStatement",
            specifiers,
            defaultImport,
            source: source.value,
            line: tok.line,
            column: tok.column,
        };
    }

    parseExportStatement() {
        const tok = this.currentToken;
        this.expect("EXPORT");
        const declaration = this.parseStatement();
        return { type: "ExportStatement", declaration, line: tok.line, column: tok.column };
    }

    // #### Return / Respond ####

    parseReturnStatement() {
        const tok = this.currentToken;
        this.expect("RETURN");
        const argument = this.parseExpression();
        return { type: "ReturnStatement", argument, line: tok.line, column: tok.column };
    }

    parseExpressionStatement() {
        const tok = this.currentToken;
        const expression = this.parseExpression();
        return { type: "ExpressionStatement", expression, line: tok.line, column: tok.column };
    }

    // #### Block ####

    parseBlock() {
        const brace = this.currentToken;
        this.expect("LBRACE");
        const body = [];
        while (this.currentToken.type !== "RBRACE" && this.currentToken.type !== "EOF") {
            body.push(this.parseStatement());
        }
        this.expect("RBRACE");
        return { type: "BlockStatement", body, line: brace.line, column: brace.column };
    }

    // #### Expression precedence chain ####

    parseExpression() {
        // HTTP verbs used as expressions: let res = GET "url"
        if (HTTP.includes(this.currentToken.type)) {
            return this.parseHttpExpression();
        }
        return this.parseAssignment();
    }

    // A "simple expression" is one that won't consume HTTP/into/save keywords
    // that belong to the enclosing statement. Used for URLs and body values.
    parseSimpleExpression() {
        return this.parseLogicalOr();
    }

    parseAssignment() {
        const left = this.parseLogicalOr();


        if (assignOps.includes(this.currentToken.type)) {
            const op = this.currentToken;
            this.advance();

            if (left.type !== "Identifier" && left.type !== "MemberExpression") {
                throw new Error("Invalid assignment target");
            }

            const right = HTTP.includes(this.currentToken.type)
                ? this.parseHttpExpression()
                : this.parseAssignment();


            return {
                type: "AssignmentExpression",
                operator: op.value,
                left,
                right,
                line: op.line,
                column: op.column,
            };
        }

        return left;
    }

    // HTTP used as an expression value (right-hand side of assignment)
    parseHttpExpression() {
        const verb = this.currentToken;
        this.advance();

        const url = this.parseSimpleExpression();

        let body = null;
        if (this.currentToken.type === "SAVE") {
            this.advance();
            body = this.parseSimpleExpression();
        }

        let headers = null;
        if (this.currentToken.type === "IDENTIFIER" && this.currentToken.value === "headers") {
            this.advance();
            headers = this.parseObjectExpression();
        }

        return {
            type: "HttpExpression",
            method: verb.value,
            url,
            body,
            headers,
            line: verb.line,
            column: verb.column,
        };
    }

    parseLogicalOr() {
        let left = this.parseLogicalAnd();
        while (this.currentToken.type === "OR") {
            const op = this.currentToken; this.advance();
            left = this.makeBinary(op, left, this.parseLogicalAnd());
        }
        return left;
    }

    parseLogicalAnd() {
        let left = this.parseEquality();
        while (this.currentToken.type === "AND") {
            const op = this.currentToken; this.advance();
            left = this.makeBinary(op, left, this.parseEquality());
        }
        return left;
    }

    parseEquality() {
        let left = this.parseComparison();
        while (this.currentToken.type === "EQ" || this.currentToken.type === "NEQ") {
            const op = this.currentToken; this.advance();
            left = this.makeBinary(op, left, this.parseComparison());
        }
        return left;
    }

    parseComparison() {
        let left = this.parseTerm();
        while (["GT", "LT", "GTE", "LTE"].includes(this.currentToken.type)) {
            const op = this.currentToken; this.advance();
            left = this.makeBinary(op, left, this.parseTerm());
        }
        return left;
    }

    parseTerm() {
        let left = this.parseFactor();
        while (this.currentToken.type === "PLUS" || this.currentToken.type === "MINUS") {
            const op = this.currentToken; this.advance();
            left = this.makeBinary(op, left, this.parseFactor());
        }
        return left;
    }

    parseFactor() {
        let left = this.parseUnary();
        while (["STAR", "SLASH", "PERCENT"].includes(this.currentToken.type)) {
            const op = this.currentToken; this.advance();
            left = this.makeBinary(op, left, this.parseUnary());
        }
        return left;
    }

    parseUnary() {
        if (this.currentToken.type === "BANG" || this.currentToken.type === "MINUS") {
            const op = this.currentToken; this.advance();
            return { type: "UnaryExpression", operator: op.value, argument: this.parseUnary(), line: op.line, column: op.column };
        }
        return this.parsePostfix();
    }

    parsePostfix() {
        let node = this.parsePrimary();

        while (true) {
            if (this.currentToken.type === "LPAREN") {
                node = this.finishCallExpression(node);
            } else if (this.currentToken.type === "DOT") {
                const dot = this.currentToken; this.advance();
                const prop = this.currentToken;
                // allow contextual keywords as property names after dot
                if (prop.type === "IDENTIFIER") {
                    this.expect("IDENTIFIER");
                } else if (prop.value != null) {
                    this.advance();
                } else {
                    const line = prop.line ?? dot.line;
                    const column = prop.column ?? dot.column;
                    throw new Error(`Expected property name after '.' at line ${line}, column ${column}`);
                }
                node = { type: "MemberExpression", object: node, property: prop.value, computed: false, line: dot.line, column: dot.column };
            } else if (this.currentToken.type === "LBRACKET") {
                const bracket = this.currentToken; this.advance();
                const index = this.parseExpression();
                this.expect("RBRACKET");
                node = { type: "MemberExpression", object: node, property: index, computed: true, line: bracket.line, column: bracket.column };
            } else {
                break;
            }
        }

        return node;
    }

    parsePrimary() {
        const token = this.currentToken;

        if (LITERAL_TYPES.has(token.type)) {
            this.advance();
            return { type: "Literal", value: token.value, line: token.line, column: token.column };
        }

        // ENV  →  treated as a special identifier that resolves to process.env
        if (token.type === "ENV") {
            this.advance();
            return { type: "EnvExpression", line: token.line, column: token.column };
        }

        if (token.type === "IDENTIFIER") {
            this.advance();
            return { type: "Identifier", name: token.value, line: token.line, column: token.column };
        }

        // Contextual keywords: when used as a value (not at statement position),
        // keywords like `update`, `limit`, `set`, `find`, `insert`, `where`, `respond`
        // are valid variable names. Treat them as identifiers here.
        if (CONTEXTUAL_KW_TYPES.has(token.type)) {
            this.advance();
            return { type: "Identifier", name: token.value, line: token.line, column: token.column };
        }
        if (token.type === "LBRACKET") return this.parseArrayExpression();
        if (token.type === "LBRACE") return this.parseObjectExpression();

        if (token.type === "LPAREN") {
            if (this.isArrowFunction()) return this.parseArrowFunction();
            this.advance();
            const expr = this.parseExpression();
            this.expect("RPAREN");
            return expr;
        }

        throw new Error(
            `Unexpected token: ${token.type}${token.line != null ? ` at line ${token.line}` : ""}`
        );
    }

    parseArrayExpression() {
        const bracket = this.currentToken;
        this.expect("LBRACKET");
        const elements = [];
        while (this.currentToken.type !== "RBRACKET" && this.currentToken.type !== "EOF") {
            elements.push(this.parseExpression());
            if (this.currentToken.type === "COMMA") this.advance();
        }
        this.expect("RBRACKET");
        return { type: "ArrayExpression", elements, line: bracket.line, column: bracket.column };
    }

    parseObjectExpression() {
        const brace = this.currentToken;
        this.expect("LBRACE");
        const properties = [];
        while (this.currentToken.type !== "RBRACE" && this.currentToken.type !== "EOF") {
            const key = this.currentToken;
            // keys can be identifiers or strings
            if (key.type !== "IDENTIFIER" && key.type !== "STRING") {
                throw new Error(`Expected object key, got ${key.type} at line ${key.line}`);
            }
            this.advance();
            this.expect("COLON");
            const value = this.parseExpression();
            properties.push({ key: key.value, value });
            if (this.currentToken.type === "COMMA") this.advance();
        }
        this.expect("RBRACE");
        return { type: "ObjectExpression", properties, line: brace.line, column: brace.column };
    }

    isArrowFunction() {
        let depth = 0, i = this.currentPos;
        while (i < this.tokens.length) {
            if (this.tokens[i].type === "LPAREN") depth++;
            else if (this.tokens[i].type === "RPAREN") {
                depth--;
                if (depth === 0) return i + 1 < this.tokens.length && this.tokens[i + 1].type === "ARROW";
            }
            i++;
        }
        return false;
    }

    parseArrowFunction() {
        const paren = this.currentToken;
        this.expect("LPAREN");
        const params = [];
        if (this.currentToken.type !== "RPAREN") {
            params.push(this.parseParam());
            while (this.currentToken.type === "COMMA") { this.advance(); params.push(this.parseParam()); }
        }
        this.expect("RPAREN");
        this.expect("ARROW");
        const body = this.currentToken.type === "LBRACE" ? this.parseBlock() : this.parseExpression();
        return { type: "ArrowFunction", params, body, line: paren.line, column: paren.column };
    }

    finishCallExpression(callee) {
        const paren = this.currentToken;
        this.expect("LPAREN");
        const args = [];
        if (this.currentToken.type !== "RPAREN") {
            args.push(this.parseExpression());
            while (this.currentToken.type === "COMMA") { this.advance(); args.push(this.parseExpression()); }
        }
        this.expect("RPAREN");
        return { type: "CallExpression", callee, arguments: args, line: paren.line, column: paren.column };
    }
}
