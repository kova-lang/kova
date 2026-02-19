// Parser Test

import Lexer from "../src/lexer.js";
import Parser from "../src/parser.js";

const runParserTest = (name, code) => {

    console.log(`\n=== TEST: ${name} ===`);
    console.log(code);
    console.log("TOKENS:");

   

    let tokens;
    let AST;

    // First try to tokenize the code string
    try {
         const lexerInit = new Lexer(code)
        tokens = lexerInit.tokenize();
        console.table(tokens);

    }
    catch (err) {
        console.log("Lexical Analysis Error: ", err)
        throw new Error("The code failed at lexical analysis");
    }

    // now let's try to parse the tokens
    try {
        const parserInit = new Parser();
        AST = parserInit.parseProgram(tokens);
        console.dir(AST, {depth:null})

    }
    catch (err) {
        console.log("Syntactic Analysis Error: ", err)
        throw new Error("The code failed at Syntactic analysis");
    }


    return AST;
}


//1. simple let statements
runParserTest("let x = 10", `
let x = 10
`);

// Test 2 — Arithmetic Precedence
runParserTest("math precedence", `
let x = 10 + 2 * 3
`);


// Test 3 — If + Block + HTTP
runParserTest("if + post", `
let x = 10
if x > 5 {
    POST "/log"
}
`);

// Test 4 — Logical
runParserTest("logical", `
if a == 1 && b == 2 || c == 3 {
    POST "/ok"
}
`);

// Test 5 — Unary
runParserTest("unary", `
let x = -10
let y = !true
`);

// Test 6 — Nested Expressions
runParserTest("nested", `
let x = (10 + 2) * 5
`);

// Test 7 — Multiple Statements
runParserTest("multi", `
let a = 1
let b = 2
POST "/hello"
`);

// Test 8 — Syntax Error Detection
runParserTest("error", `
let x 10
`);