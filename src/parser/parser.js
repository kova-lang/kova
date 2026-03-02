export default class Parser {
    constructor() {
        this.tokens = [];
        this.currentPos = 0;
        this.currentToken = null;
    }

    advance() {
        this.currentPos++;
        this.currentToken = this.currentPos < this.tokens.length
            ? this.tokens[this.currentPos]
            : { type: "EOF" };
    }

    expect(type) {
        if (!this.currentToken || this.currentToken.type !== type) {
            throw new Error(
                `Expected ${type} but got ${this.currentToken?.type ?? "null"}`
            );
        }
        this.advance();
    }

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

    parseStatement() {
        switch (this.currentToken.type) {
            case "LET": return this.parseVariableDeclaration();
            case "IF": return this.parseIfStatement();
            case "POST_HTTP":
            case "GET_HTTP":
            case "PUT_HTTP":
            case "DELETE_HTTP": return this.parseHttpStatement();
            case "LBRACE": return this.parseBlock();
            case "RETURN": return this.parseReturnStatement();
            default: return this.parseExpressionStatement();
        }
    }

    parseVariableDeclaration() {
        const letToken = this.currentToken;          // capture location
        this.expect("LET");

        const id = this.currentToken;
        this.expect("IDENTIFIER");
        this.expect("ASSIGN");

        const init = this.parseExpression();

        return {
            type: "VariableDeclaration",
            id: { type: "Identifier", name: id.value, line: id.line, column: id.column },
            init,
            line: letToken.line,
            column: letToken.column,
        };
    }

    parseIfStatement() {
        const ifToken = this.currentToken;           // capture location
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

        return {
            type: "IfStatement",
            test,
            consequent,
            alternate,
            line: ifToken.line,
            column: ifToken.column,
        };
    }

    parseBlock() {
        const brace = this.currentToken;             // capture location
        this.expect("LBRACE");

        const body = [];
        while (this.currentToken.type !== "RBRACE" && this.currentToken.type !== "EOF") {
            body.push(this.parseStatement());
        }
        this.expect("RBRACE");

        return {
            type: "BlockStatement",
            body,
            line: brace.line,
            column: brace.column,
        };
    }

    parseHttpStatement() {
        const verb = this.currentToken;
        this.advance();

        const urlToken = this.currentToken;
        this.expect("STRING");

        return {
            type: "HttpStatement",
            method: verb.value,
            url: urlToken.value,
            line: verb.line,
            column: verb.column,
        };
    }

    parseExpressionStatement() {
        const token = this.currentToken;
        const expression = this.parseExpression();
        return {
            type: "ExpressionStatement",
            expression,
            line: token.line,
            column: token.column,
        };
    }

    parseReturnStatement() {
        const retToken = this.currentToken;          // capture location
        this.expect("RETURN");

        const argument = this.parseExpression();
        return {
            type: "ReturnStatement",
            argument,
            line: retToken.line,
            column: retToken.column,
        };
    }

    //  Expression precedence chain

    parseExpression() {
        return this.parseAssignment();
    }

    parseAssignment() {
        const left = this.parseLogicalOr();

        if (this.currentToken.type === "ASSIGN") {
            const op = this.currentToken;
            this.advance();
            const right = this.parseAssignment();

            if (left.type !== "Identifier") {
                throw new Error("Invalid assignment target");
            }

            return {
                type: "AssignmentExpression",
                left,
                right,
                line: op.line,
                column: op.column,
            };
        }

        return left;
    }

    parseLogicalOr() {
        let left = this.parseLogicalAnd();
        while (this.currentToken.type === "OR") {
            const op = this.currentToken;
            this.advance();
            const right = this.parseLogicalAnd();
            left = {
                type: "BinaryExpression", operator: op.value, left, right,
                line: op.line, column: op.column
            };
        }
        return left;
    }

    parseLogicalAnd() {
        let left = this.parseEquality();
        while (this.currentToken.type === "AND") {
            const op = this.currentToken;
            this.advance();
            const right = this.parseEquality();
            left = {
                type: "BinaryExpression", operator: op.value, left, right,
                line: op.line, column: op.column
            };
        }
        return left;
    }

    parseEquality() {
        let left = this.parseComparison();
        while (this.currentToken.type === "EQ" || this.currentToken.type === "NEQ") {
            const op = this.currentToken;
            this.advance();
            const right = this.parseComparison();
            left = {
                type: "BinaryExpression", operator: op.value, left, right,
                line: op.line, column: op.column
            };
        }
        return left;
    }

    parseComparison() {
        let left = this.parseTerm();
        while (["GT", "LT", "GTE", "LTE"].includes(this.currentToken.type)) {
            const op = this.currentToken;
            this.advance();
            const right = this.parseTerm();
            left = {
                type: "BinaryExpression", operator: op.value, left, right,
                line: op.line, column: op.column
            };
        }
        return left;
    }

    parseTerm() {
        let left = this.parseFactor();
        while (this.currentToken.type === "PLUS" || this.currentToken.type === "MINUS") {
            const op = this.currentToken;
            this.advance();
            const right = this.parseFactor();
            left = {
                type: "BinaryExpression", operator: op.value, left, right,
                line: op.line, column: op.column
            };
        }
        return left;
    }

    parseFactor() {
        let left = this.parseUnary();
        while (this.currentToken.type === "STAR" || this.currentToken.type === "SLASH") {
            const op = this.currentToken;
            this.advance();
            const right = this.parseUnary();
            left = {
                type: "BinaryExpression", operator: op.value, left, right,
                line: op.line, column: op.column
            };
        }
        return left;
    }

    parseUnary() {
        if (this.currentToken.type === "BANG" || this.currentToken.type === "MINUS") {
            const op = this.currentToken;
            this.advance();
            const argument = this.parseUnary();
            return {
                type: "UnaryExpression", operator: op.value, argument,
                line: op.line, column: op.column
            };
        }
        return this.parsePrimary();
    }

    parsePrimary() {
        const token = this.currentToken;

        if (token.type === "NUMBER") {
            this.advance();
            return {
                type: "Literal", value: token.value,
                line: token.line, column: token.column
            };
        }
        if (token.type === "STRING") {
            this.advance();
            return {
                type: "Literal", value: token.value,
                line: token.line, column: token.column
            };
        }
        if (token.type === "BOOLEAN") {
            this.advance();
            return {
                type: "Literal", value: token.value,
                line: token.line, column: token.column
            };
        }
        if (token.type === "IDENTIFIER") {
            this.advance();
            let node = {
                type: "Identifier", name: token.value,
                line: token.line, column: token.column
            };
            while (this.currentToken.type === "LPAREN") {
                node = this.finishCallExpression(node);
            }
            return node;
        }
        if (token.type === "LPAREN") {
            this.advance();
            const expr = this.parseExpression();
            this.expect("RPAREN");
            return expr;                              // location already on inner expr
        }

        throw new Error(`Unexpected token: ${token.type}`);
    }

    finishCallExpression(callee) {
        const paren = this.currentToken;
        this.expect("LPAREN");

        const args = [];
        if (this.currentToken.type !== "RPAREN") {
            args.push(this.parseExpression());
            while (this.currentToken.type === "COMMA") {
                this.advance();
                args.push(this.parseExpression());
            }
        }
        this.expect("RPAREN");

        return {
            type: "CallExpression",
            callee,
            arguments: args,
            line: paren.line,
            column: paren.column,
        };
    }
}
