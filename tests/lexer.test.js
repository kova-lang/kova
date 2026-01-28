import Lexer from "../src/lexer.js";

function runLexerTest(name, code) {
    console.log(`\n=== TEST: ${name} ===`);
    console.log(code);
    console.log("TOKENS:");

    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        console.table(tokens);
    } catch (err) {
        console.error("LEXER ERROR:", err.message);
    }
}

// Test 1: Variable decalaration and assignment
runLexerTest(
    "let statement",
    `let x = 10`
);

// Test 2: Identifier with numbers (valid)
runLexerTest(
    "identifier with numbers",
    "let user1 = 42"
);

// Test 3: Arithmetic operations
runLexerTest(
    "math expression",
    "let sum = a + b - c * d / e % f;"
);