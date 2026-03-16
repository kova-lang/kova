import Lexer              from "./lexer/lexer.js";
import Parser             from "./parser/parser.js";
import SemanticAnalyzer   from "./semantic/semanticAnalyzer.js";
import Interpreter        from "./interpreter/interpreter.js";
import { buildGraph }     from "./graph/executionGraph.js";
import { defaultExternals, defaultSignatures } from "../lib/functions/index.js";
import { groqAI, stubAI, isProb, resolveProb, makeProb } from "./ai/groq.js";

export { defaultExternals, defaultSignatures };
export { buildGraph }     from "./graph/executionGraph.js";
export { isProb, resolveProb, makeProb } from "./ai/groq.js";


// #### AI Provider ####

function makeAIExternal(aiMode) {
    return async function AI(task, input, schema = null) {
        if (aiMode === "stub" || !process.env.GROQ_API_KEY) {
            return stubAI(task, input, schema);
        }
        return groqAI(task, input, schema);
    };
}


// #### runKova (async) ####

export async function runKova(code, externals = {}, externalSignatures = {}, options = {}) {
    const aiMode = options.aiMode ?? (process.env.GROQ_API_KEY ? "groq" : "stub");

    const aiExternals = {
        AI:      makeAIExternal(aiMode),
        resolve: resolveProb,
    };

    const allExternals  = { ...defaultExternals, ...aiExternals, ...externals };
    const allSignatures = { ...defaultSignatures, ...externalSignatures };

    try {
        const lexer  = new Lexer(code);
        const tokens = lexer.tokenize();

        const parser = new Parser();
        const ast    = parser.parseProgram(tokens);

        const semantic = new SemanticAnalyzer(code, allExternals, allSignatures);
        semantic.analyze(ast);

        const interpreter = new Interpreter(allExternals);
        const result      = await interpreter.interpret(ast);

        const { graph, graphInstance } = buildGraph(ast);

        return {
            ...result,
            ast, tokens,
            graph: {
                ...graph,
                json:               graphInstance.toJSON(),
                sourceNodes:        graphInstance.sourceNodes(),
                topologicalOrder:   graphInstance.topologicalOrder(),
                parallelCandidates: graphInstance.parallelCandidates(),
            },
        };

    } catch (err) {
        if (err.format) err.formatted = err.format();
        throw err;
    }
}


// #### runKovaSync — stub AI only, no network ####

export function runKovaSync(code, externals = {}, externalSignatures = {}) {
    const aiExternals = {
        AI:      (task, input, schema) => stubAI(task, input, schema),
        resolve: resolveProb,
    };

    const allExternals  = { ...defaultExternals, ...aiExternals, ...externals };
    const allSignatures = { ...defaultSignatures, ...externalSignatures };

    const lexer  = new Lexer(code);
    const tokens = lexer.tokenize();

    const parser = new Parser();
    const ast    = parser.parseProgram(tokens);

    const semantic = new SemanticAnalyzer(code, allExternals, allSignatures);
    semantic.analyze(ast);

    const interpreter = new Interpreter(allExternals);
    const result      = interpreter.interpretSync(ast);

    const { graph, graphInstance } = buildGraph(ast);

    return {
        ...result,
        ast, tokens,
        graph: {
            ...graph,
            json:               graphInstance.toJSON(),
            sourceNodes:        graphInstance.sourceNodes(),
            topologicalOrder:   graphInstance.topologicalOrder(),
            parallelCandidates: graphInstance.parallelCandidates(),
        },
    };
}


// #### parseKova — parse only, no run ####

export function parseKova(code) {
    const lexer  = new Lexer(code);
    const tokens = lexer.tokenize();

    const parser = new Parser();
    const ast    = parser.parseProgram(tokens);

    const { graph, graphInstance } = buildGraph(ast);

    return {
        ast, tokens,
        graph: { ...graph, json: graphInstance.toJSON() },
    };
}


// #### tokenizeKova ####

export function tokenizeKova(code) {
    return new Lexer(code).tokenize();
}