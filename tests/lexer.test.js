import Lexer from "../src/lexer/lexer.js";

export function runLexerTest(name, code) {
    console.log(`\n=== TEST: ${name} ===`);
    console.log(code);
    console.log("TOKENS:");

    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        console.table(tokens);
        return tokens;
    } catch (err) {
        console.error("LEXER ERROR:", err.message);
        return err.message;
    }
}

console.log("################### Test Init ##################")
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
    "let sum = a + b - c * d / e % f"
);

// Test 4: Boolean Literals
runLexerTest(
    "boolean literals",
    `let isActive = true
     let isAdmin = false`
);

// Test 5: String Handling
runLexerTest(
    "string handling",
    `let greeting = "Hello, World!"`
);

// Test 6: comparison operators
runLexerTest(
    "comparison operators",
    `if x == 10
     if y != 5
     if z >= 1
     if a <= 9`);

// Test 7: Logical operators
runLexerTest(
    "logical operators",
    `if a == 1 && b == 2 || c == 3`
);

// Test 8: braces and Programming Symbols
runLexerTest(
    "program symbols",
    `{ ( ) , : }`
);

// Test 9: String literals
runLexerTest("string literals", `let name = "Kova"`);

// Test 10: Edge case - invalid tokens
runLexerTest("invalid identifier1", `let 1user = 10`);
// Will not throw error because we did not explitly define the law at the lexer level but will throw at the parser level: it will generate the token for the declaration statement as let, minus, identifier, assign, number and EOF but at parser level it will not match the grammar for declaration statement because we would be expecting let + identifier + assign + expression 

runLexerTest("invalid identifier2", `let -user = 15`);

runLexerTest("number followed by identifier", `let x = 123abc`);
runLexerTest("unterminated string", `let x = "oops`);
runLexerTest("invalid character", `let x = 10 @ 2`);

// Test 11: comments
runLexerTest("comments", "# This is a comment \n let x = 10 \n // Another comment");

// Test 12: imports
runLexerTest("Imports", `import math from "lib/math.kova"`);

// Test 13: Environment variables
runLexerTest("Environment Variables", `ENV.DB_HOST`);