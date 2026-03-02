import Lexer from "./lexer/lexer.js";
import Parser from "./parser/parser.js";
import SemanticAnalyzer from "./semantic/semanticAnalyzer.js";
import Interpreter from "./interpreter/interpreter.js";


export function runKova(code, externals = {}, externalSignatures = {}) {

    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();

    const parser = new Parser();
    const ast = parser.parseProgram(tokens);

    const semantic = new SemanticAnalyzer(externals, externalSignatures);
    semantic.analyze(ast);

    const interpreter = new Interpreter(externals);
    return interpreter.interpret(ast);
}