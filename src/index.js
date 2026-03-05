import Lexer from "./lexer/lexer.js";
import Parser from "./parser/parser.js";
import SemanticAnalyzer from "./semantic/semanticAnalyzer.js";
import Interpreter from "./interpreter/interpreter.js";
import { defaultExternals, defaultSignatures } from "../lib/functions/index.js";

export { defaultExternals, defaultSignatures };

/**
 * Run a Kova program from source code.
 *
 * @param {string} code - Kova source code
 * @param {object} externals - External JS functions available inside Kova
 * @param {object} externalSignatures - Type signatures for external functions
 * @returns {{ returnValue: any, output: string[], ast: object, tokens: any[] }}
 */
export function runKova(code, externals = {}, externalSignatures = {}) {
    const allExternals = { ...defaultExternals, ...externals };
    const allSignatures = { ...defaultSignatures, ...externalSignatures };

    try {
        // 1. Lex
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();

        // 2. Parse
        const parser = new Parser();
        const ast = parser.parseProgram(tokens);

        // 3. Semantic analysis
        const semantic = new SemanticAnalyzer(code, allExternals, allSignatures);
        semantic.analyze(ast);

        // 4. Interpret
        const interpreter = new Interpreter(allExternals);
        const result = interpreter.interpret(ast);

        return { ...result, ast, tokens };

    } catch (err) {
        if (err.format) {
            // Attach formatted message for richer error reporting
            err.formatted = err.format();
        }
        throw err;
    }
}

/**
 * Parse-only: returns the AST without executing.
 * Useful for tooling, syntax highlighting, execution graphs.
 */
export function parseKova(code) {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser();
    return { ast: parser.parseProgram(tokens), tokens };
}

/**
 * Tokenize-only: returns the token stream.
 */
export function tokenizeKova(code) {
    return new Lexer(code).tokenize();
}
