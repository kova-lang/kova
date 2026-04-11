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
            let lookahead = current < code.length - 1 ? code[current + 1] : null;
            while (current < code.length && /[0-9]/.test(code[current])) {
                if (/[A-Za-z]/.test(lookahead)) {
                    throw new Error(`Invalid number format at position ${current}: numbers cannot be at the start of an identifier.`);
                }
                value += code[current];
                current++;
            }
            tokens.push({
                type: "NUMBER",
                value: value
            })
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
console.log(tokenize("2xt + 5")); // should throw error: numbers cannot be at the start of an identifier

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

        if (!token || token.type !== tyep) {
            throw new Error(`Expected token ${type}, got ${token ? token.type : "EOF"}`);
        }
        return consume();
    }

    return{
        peek,
        consume,
        expect
    }
} 