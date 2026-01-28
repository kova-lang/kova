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
