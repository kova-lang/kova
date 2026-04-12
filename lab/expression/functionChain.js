// ################################################ Function chain Approach  #######################################################

// Lexer: raw code -> tokens
const tokenize = (code) => {
    const tokens = [];
    let current = 0;
    while (current < code.length) {
        const char = code[current];

        // Always start by ignoring spaces
        if ([" ", "\n", "\t", "\r"].includes(char)) {
            current++
            continue;
        }
        // Next: Numbers
        if (/[0-9]/.test(char)) {
            let value = "";
            while (current < code.length && /[0-9]/.test(code[current])) {

                value += code[current];
                current++;
            }
            if (current < code.length && /[A-Za-z_]/.test(code[current])) {
                throw new Error(
                    `Invalid number format at position ${current}: numbers cannot be at the start of an identifier.`
                );
            }
            tokens.push({
                type: "NUMBER",
                value: value
            })
            continue;
        }
        // Identifier tokenizer

        if (/[a-zA-Z_]/.test(char)) {
            let value = "";

            while (current < code.length && /[a-zA-Z0-9_]/.test(code[current])) {
                value += code[current];
                current++;
            }

            tokens.push({
                type: "IDENTIFIER",
                value
            });

            continue;
        }

        // Next: Single character operators and parentheses
        if (["+", "-", "*", "/", "(", ")"].includes(char)) {
            tokens.push({
                type: char,
                value: char
            })
            current++
            continue
        }

        throw new Error(`Unexpected character: ${char}`);
    }
    return tokens;
}

console.log(tokenize("12 + 3 * (4 - 1)"));
// console.log(tokenize("2xt + 5")); // should throw error: numbers cannot be at the start of an identifier

// Parser: Tokens -> AST

const createParser = (tokens) => {
    let current = 0;

    // Return Current token without moving forward;
    const peek = () => {
        return current < tokens.length ? tokens[current] : null
    }

    // Consumes and returns the current token
    const consume = () => {
        return current < tokens.length ? tokens[current++] : null
    }

    // Check token matches expceted type
    const expect = (type) => {
        const token = peek();

        if (!token || token.type !== type) {
            throw new Error(`Expected token ${type}, got ${token ? token.type : "EOF"}`);
        }
        return consume();
    }

    return {
        peek,
        consume,
        expect
    }
}

// main parser function

const parse = (tokens) => {

    const parser = createParser(tokens);

    const parseExpression = () => {
        return parseAdditive()
    }

    /**
     * Parses:
     * - number literals
     * - grouped expressions in parentheses
     */
    const parsePrimary = () => {
        const token = parser.peek();
        if (!token) {
            throw new Error("Unexpected end of input");
        }
        if (token.type === "NUMBER") {
            parser.consume();

            return {
                type: "NumberLiteral",
                value: token.value
            }
        }

        if (token.type === "(") {
            parser.consume();
            const expression = parseExpression();
            parser.expect(")")
            return expression
        }
        throw new Error(`Unexpected token in primary expression: ${token.type}`);
    }
    // Parse Unary
    const parseUnary = () => {
        const token = parser.peek();

        // Handle unary + and -
        if (token && (token.type === "+" || token.type === "-")) {
            const operator = parser.consume().type;

            const argument = parseUnary(); // recursion allows multiple unary ops

            return {
                type: "UnaryExpression",
                operator,
                argument
            };
        }

        return parsePrimary();
    }

    /**
 * Parses + and - expressions.
 * Lower precedence than multiplicative expressions.
 */
    const parseAdditive = () => {
        let left = parseMultiplicative();

        while (parser.peek() && (parser.peek().type === "+" || parser.peek().type === "-")) {
            const op = parser.consume().type;
            const right = parseMultiplicative();

            left = {
                type: "BinaryExpression",
                op,
                left,
                right
            };
        }

        return left;
    }

    /**
    * Parses * and / expressions.
    * Higher precedence than additive expressions.
    */
    const parseMultiplicative = () => {
        let left = parseUnary();

        // keep consuming * and / as long as they appear
        while (parser.peek() && (parser.peek().type === "*" || parser.peek().type === "/")) {
            const op = parser.consume().type;
            const right = parseUnary();

            left = {
                type: "BinaryExpression",
                op,
                left,
                right
            }

        }
        return left;
    }
    const ast = parseExpression();

    if (parser.peek() !== null) {
        throw new Error(`Unexpected token after expression: ${parser.peek().type}`);
    }
    return ast;
}

// Test
const input1 = "2 * 3 + 3 * 5 + 2 * (4 - 1)";
const input2 = "3 + 2 + 5 + 4 + 7 + 7 * 3"
const tokens1 = tokenize(input1);
const tokens2 = tokenize(input2);
const ast1 = parse(tokens1);
const ast2 = parse(tokens2);

console.log(JSON.stringify(ast1, null, 2));
console.log(JSON.stringify(ast2, null, 5)); + 3 * (4 - 1)