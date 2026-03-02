import Interpreter from "./interpreter/interpreter.js";
import Lexer from "./lexer/lexer.js";
import Parser from "./parser/parser.js";
import SemanticAnalyzer from "./semantic/semanticAnalyzer.js";

export function runKova(code, externals = {}, externalSignatures = {}) {
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();

        const parser = new Parser();
        const ast = parser.parseProgram(tokens);

        
        const semantic = new SemanticAnalyzer(code, externals, externalSignatures);
        semantic.analyze(ast);

        const interpreter = new Interpreter(externals);
        return interpreter.interpret(ast);

    } catch (err) {
        if (err.format) {
           
            console.error(err.format());
        }
       
        throw err;
    }
}