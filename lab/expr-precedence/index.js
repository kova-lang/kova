
/**
 * 
 * A self-contained Pratt parser for arithmetic and comparison expressions.
 * Models JavaScript's precedence table from lowest to highest binding power.
 *
 * Concepts demonstrated:
 *   - - - - - - - - - - - -
 */

// #### Okay, so first, what is a Pratt Parser?
//  Pratt Parser, also known as the Top-down Operator Precedence parser is an algo used to parse programming languages. Cliche!
// But here is the catch. unlike the function chain approach that we implemented in the main folder (src), the Pratt perser uses a numerical value known as the binding power representing the operators's precedence. It makes use of two handler function, Null and Left detonaation, (NUD) and (LED) respectively.
// The NUD is the handler function is for token that appears at the beginning of an expression, the prefix position.
// The LED is for when the token has the expression occuring at the left.
/**
 * Feature    -    Function Chain (Recursive Descent)	       -     Pratt Parser
Logic	      -    Implicitly hardcoded in function calls	   -     Defined as data (precedence tables)
Associativity -	   Handled by the order/structure of calls	   -     Handled by adjusting binding power
Maintenance	  -    Adding an operator requires             	   -     Adding an operator just requires a new table entry
                   adding/modifying functions
 */

// #### Now lets code;


// #### The Lexer #####
// This regex will be used to test each char in the code string respectively
const Token_Reg = /\s*(\d+(?:\.\d+)?|\*\*|&&|\|\||[<>]=?|[!=]=|[+\-*\/^%]|[(),]|[a-zA-Z_]\w*)\s*/y;

const tokenise = (code) => {
    const tokens = [];
    let pos = 0;

    while (pos < code.length) {
        Token_Reg.lastIndex = pos;

        const m = Token_Reg.exec(code);

        if (!m) {
            throw new Error("Unexpected token at position " + pos);
        }

        tokens.push(m[1]);

        // Move forward manually
        pos = Token_Reg.lastIndex;
    }

    tokens.push("EOF");
    return tokens;
};

// #### Parser state ####
// inits
let tokens = [];
let pos = 0;
// methods
const peek = () => {
    return tokens[pos];
};
const advance = () => {
    return tokens[pos++]; // the first call will return the token at the init pos, which is of index 0.
}
const expect = (token) => {
    const got = advance();
    if (got !== token) throw new Error(`Expected '${t}', got '${got}'`);
    return got;
}

// #### Binding power table ####
//
// JavaScript precedence (simplified), lower number = lower precedence.
// Each binary operator maps to [leftBP, rightBP].
// leftBP  = minimum bp the left operand must have been parsed at
// rightBP = bp passed recursively for the right operand
//
// Left-associative:  rightBP == leftBP      e.g. + -
// Right-associative: rightBP == leftBP - 1  e.g. **

const LED_BP = {
    "||": [6, 6],   // logical or         (left)
    "&&": [7, 7],   // logical and        (left)
    "==": [10, 10],   // equality           (left)
    "!=": [10, 10],
    "<": [11, 11],   // relational         (left)
    ">": [11, 11],
    "<=": [11, 11],
    ">=": [11, 11],
    "+": [13, 13],   // additive           (left)
    "-": [13, 13],
    "*": [14, 14],   // multiplicative     (left)
    "/": [14, 14],
    "%": [14, 14],
    "**": [15, 14],   // exponentiation     (RIGHT: rightBP is lower)
};

// Prefix binding powers for unary operators
const NUD_BP = {
    "-": 16,
    "+": 16,
    "!": 16,
};

// #### Pratt Perser Core ####

const parseExpr = (minBP = 0) => {
    let left = parseNud();

    while (true) {
        const op = peek();
        const entry = LED_BP[op];
        if (!entry) break;
        const [leftBP, rightBP] = entry;
        if (leftBP <= minBP) break;   // not strong enough to grab our left side
        advance();                     // consume the operator
        const right = parseExpr(rightBP);
        left = { type: "BinOp", op, left, right };
    }

    return left;
}

// Helper function 
const parseNud = () => {
    const tok = advance();

    // Number literal
    if (/^\d/.test(tok)) {
        return { type: "Num", value: parseFloat(tok) };
    }

    // Identifier (variable)
    if (/^[a-zA-Z_]/.test(tok)) {
        return { type: "Var", name: tok };
    }

    // Grouped expression
    if (tok === "(") {
        const inner = parseExpr(0);
        expect(")");
        return inner;
    }

    // Unary prefix
    const ubp = NUD_BP[tok];
    if (ubp !== undefined) {
        const operand = parseExpr(ubp);
        return { type: "UnOp", op: tok, operand };
    }

    throw new Error(`Unexpected token in nud: '${tok}'`);
}

// AST printer (compact s-expression form, easy to read)
function pretty(node) {
  switch (node.type) {
    case "Num": return String(node.value);
    case "Var": return node.name;
    case "UnOp": return `(${node.op} ${pretty(node.operand)})`;
    case "BinOp": return `(${node.op} ${pretty(node.left)} ${pretty(node.right)})`;
    default: return "?";
  }
}
 

// runner

function run(src, env = {}) {
  tokens = tokenise(src);
  pos = 0;
  const ast = parseExpr(0);
  const result = evaluate(ast, env);
  console.log(`  expr : ${src}`);
  console.log(`  ast  : ${pretty(ast)}`);
  console.log(`  eval : ${result}`);
  console.log();
}
 
console.log("=== Pratt Parser: Expression Precedence Lab ===\n");
 
console.log("-- Precedence: * binds tighter than +");
run("1 + 2 * 3");           // expects 7, ast: (+ 1 (* 2 3))
 
console.log("-- Left-associativity: - chains left");
run("10 - 3 - 2");          // expects 5, ast: (- (- 10 3) 2)
 
console.log("-- Right-associativity: ** chains right");
run("2 ** 3 ** 2");         // expects 512, ast: (** 2 (** 3 2))
 
console.log("-- Grouping overrides precedence");
run("(1 + 2) * 3");         // expects 9
 
console.log("-- Unary minus");
run("-2 ** 2");              // expects -4, unary binds tighter than **? No: -(2**2)
// NOTE: in JS, -2**2 is a syntax error. Here unary - has bp 16 > ** leftBP 15
// so this parses as (- (** 2 2)) = -4. Deliberate: worth knowing.
 
console.log("-- Comparison chains (non-associative in JS, left here)");
run("1 < 2");                // true
 
console.log("-- Logical operators, short-circuit eval");
run("1 == 1 && 2 < 3");     // true
 
console.log("-- Variables");
run("x * x + y * y", { x: 3, y: 4 }); // 25