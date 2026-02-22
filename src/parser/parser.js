// Parser.js

// #### main parser class ####
export default class Parser {
    constructor() {
        this.tokens = [];
        this.currentPos = 0
        this.currentToken = this.tokens? this.tokens[0] : null;
    }

    // #### Advance to the next token in the token stream ####
    advance() {
        this.currentPos++;
        if (this.currentPos < this.tokens.length){
            this.currentToken = this.tokens[this.currentPos];
        }
       else{
            this.currentToken = {type: "EOF"}
       }
    }

    // #### Expect a specific token type and advance if it matches, otherwise throw an error ####
    expect(type) {
        if (!this.currentToken  || this.currentToken.type !== type) {
            throw new Error(`Expected ${type} but got ${this.currentToken.type? this.currentToken.type : "null"}`)
        }
        this.advance();
    };

    // #### parse program ####
    parseProgram(tokens) {
        this.tokens = tokens;
        this.currentPos = 0
        this.currentToken = this.tokens? this.tokens[0] : null;

        const body = [];

        while (this.currentToken.type && this.currentToken.type !== "EOF") {
            body.push(this.parseStatement());
        }

        return {
            type: "Program",
            body
        };
    }

    // #### parse Statement ####
    parseStatement() {
        switch (this.currentToken.type) {
            case "LET":
                return this.parseVariableDeclaration();

            case "IF":
                return this.parseIfStatement();

            case "POST_HTTP":
            case "GET_HTTP":
            case "PUT_HTTP":
            case "DELETE_HTTP":
                return this.parseHttpStatement();

            case "LBRACE":
                return this.parseBlock();

            default:
                return this.parseExpressionStatement();
        }
    }

    //#### parse variable declarion
    parseVariableDeclaration() {
        this.expect("LET");

        const id = this.currentToken;
        this.expect("IDENTIFIER");

        this.expect("ASSIGN"); // "=" token

        const init = this.parseExpression();

        return {
            type: "VariableDeclaration",
            id: { type: "Identifier", name: id.value },
            init
        };
    }
    // #### parse if statement
    parseIfStatement() {
        this.expect("IF");

        const test = this.parseExpression();
        const consequent = this.parseBlock();

        return {
            type: "IfStatement",
            test,
            consequent
        };
    }

    // ### Block ####
    parseBlock() {

        this.expect("LBRACE");

        const body = [];

        while (this.currentToken.type !== "RBRACE" && this.currentToken.type !== "EOF") {
            body.push(this.parseStatement());
        }

        this.expect("RBRACE");

        return {
            type: "BlockStatement",
            body
        };
    }

    // ### POST statement
    parseHttpStatement() {
        const verb = this.currentToken;
        this.advance(); // consume verb

        const urlToken = this.currentToken;
        this.expect("STRING");

        return {
            type: "HttpStatement",
            method: verb.value,
            url: urlToken.value
        };
    }

    // #### Expression Statement
    parseExpressionStatement() {
        const expression = this.parseExpression();

        return {
            type: "ExpressionStatement",
            expression
        };
    }

    // #### Expression system entry
    parseExpression() {
        return this.parseLogicalOr();
    }

    // Expression precedence

    // // ####  Logical OR
    parseLogicalOr() {
        let left = this.parseLogicalAnd();

        while (this.currentToken.type === "OR") {
            const operator = this.currentToken;
            this.advance();

            const right = this.parseLogicalAnd();

            left = {
                type: "BinaryExpression",
                operator: operator.value,
                left,
                right
            };
        }

        return left;
    }
    // // ####  Logical AND
    parseLogicalAnd() {
        let left = this.parseEquality();

        while (this.currentToken.type === "AND") {
            const operator = this.currentToken;
            this.advance();

            const right = this.parseEquality();

            left = {
                type: "BinaryExpression",
                operator: operator.value,
                left,
                right
            };
        }

        return left;
    }
    // // ####  EQUALITY
    parseEquality() {
        let left = this.parseComparison();

        while (
            this.currentToken.type === "EQ" ||
            this.currentToken.type === "NEQ"
        ) {
            const operator = this.currentToken;
            this.advance();

            const right = this.parseComparison();

            left = {
                type: "BinaryExpression",
                operator: operator.value,
                left,
                right
            };
        }

        return left;
    }
    // // ####  Comparison
    parseComparison() {
        let left = this.parseTerm();

        while (
            this.currentToken.type === "GT" ||
            this.currentToken.type === "LT" ||
            this.currentToken.type === "GTE" ||
            this.currentToken.type === "LTE"
        ) {
            const operator = this.currentToken;
            this.advance();

            const right = this.parseTerm();

            left = {
                type: "BinaryExpression",
                operator: operator.value,
                left,
                right
            };
        }

        return left;
    }

    // #### Parse Term
    parseTerm() {
        let left = this.parseFactor();

        while (
            this.currentToken.type === "PLUS" ||
            this.currentToken.type === "MINUS"
        ) {
            const operator = this.currentToken;
            this.advance();

            const right = this.parseFactor();

            left = {
                type: "BinaryExpression",
                operator: operator.value,
                left,
                right
            };
        }

        return left;
    }

    // #### Parse Factor
    parseFactor() {
        let left = this.parseUnary();

        while (
            this.currentToken.type === "STAR" ||
            this.currentToken.type === "SLASH"
        ) {
            const operator = this.currentToken;
            this.advance();

            const right = this.parseUnary();

            left = {
                type: "BinaryExpression",
                operator: operator.value,
                left,
                right
            };
        }

        return left;
    }

    // #### parse unary  - || !
    parseUnary() {
        if (
            this.currentToken.type === "BANG" ||
            this.currentToken.type === "MINUS"
        ) {
            const operator = this.currentToken;
            this.advance();

            const argument = this.parseUnary();

            return {
                type: "UnaryExpression",
                operator: operator.value,
                argument
            };
        }

        return this.parsePrimary();
    }

    // #### Primary - base layer
    parsePrimary() {
        const token = this.currentToken;

        if (token.type === "NUMBER") {
            this.advance();
            return {
                type: "Literal",
                value: token.value
            };
        }

        if (token.type === "STRING") {
            this.advance();
            return {
                type: "Literal",
                value: token.value
            };
        }

        if (token.type === "BOOLEAN") {
            this.advance();
            return {
                type: "Literal",
                value: token.value
            };
        }

        if (token.type === "IDENTIFIER") {
            this.advance();
            return {
                type: "Identifier",
                name: token.value
            };
        }

        if (token.type === "LPAREN") {
            this.advance();

            const expr = this.parseExpression();

            this.expect("RPAREN");

            return expr;
        }

        throw new Error(`Unexpected token: ${token.type}`);
    }


};