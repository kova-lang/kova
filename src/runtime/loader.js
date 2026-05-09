import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { RuntimeError } from "../core/diagnostic.js";
import Lexer from "../lexer/lexer.js";
import Parser from "../parser/parser.js";
import SemanticAnalyzer from "../semantic/semanticAnalyzer.js";
import Interpreter from "../interpreter/interpreter.js";

// Cache: absolutePath -> export map
const moduleCache = new Map();

// Loading set: tracks modules currently mid-load for circular detection
const loadingSet = new Set();

/**
 * Resolves and loads a .kova module, returning its export map.
 * @param {string} importPath   - raw path string from the import statement
 * @param {string} importerPath - absolute path of the file doing the importing
 * @param {Object} externals    - inherited externals from the parent runKova call
 * @param {Object} signatures   - inherited signatures from the parent runKova call
 * @returns {Object} - { exports: { name -> value }, ast }
 */
export async function loadModule(importPath, importerPath, externals, signatures) {
    const absolutePath = resolve(dirname(importerPath), importPath);

    if (moduleCache.has(absolutePath)) {
        return moduleCache.get(absolutePath);
    }

    if (loadingSet.has(absolutePath)) {
        throw new RuntimeError(
            `Circular import detected: "${absolutePath}" is already being loaded`
        );
    }

    loadingSet.add(absolutePath);

    let source;
    try {
        source = readFileSync(absolutePath, "utf8");
    } catch {
        throw new RuntimeError(
            `Cannot find module "${importPath}" (resolved to "${absolutePath}")`
        );
    }

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    const parser = new Parser();
    const ast = parser.parseProgram(tokens);

    const semantic = new SemanticAnalyzer(source, externals, signatures);
    semantic.analyze(ast);

    const interpreter = new Interpreter(externals);
    interpreter.filePath = absolutePath;
    interpreter.signatures = signatures;
    await interpreter.interpret(ast);

    const result = {
        exports: interpreter.exportMap ?? {},
        ast,
        importedASTs: interpreter.importedASTs ?? [],
    };

    moduleCache.set(absolutePath, result);
    loadingSet.delete(absolutePath);

    return result;
}

export function clearModuleCache() {
    moduleCache.clear();
    loadingSet.clear();
}