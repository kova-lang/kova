import {resolve, dirname} from "path";
import { readFileSync } from "fs";
import { RuntimeError } from "../core/diagnostic";

// Cache: absolutePath -> export map
const moduleCache = new Map();

// Loading set: tracks modules currently being loaded (for circular detection)
const loadingSet = new Set();

/**
 * Resolves and loads a .kova module, returning its export map.
 * @param {string} importPath - the raw path string from the import statement
 * @param {string} importerPath - absolute path of the file doing the importing
 * @param {Function} parse - the Kova parser function
 * @param {Function} makeInterpreter - factory that returns a fresh Interpreter instance
 * @returns {Object} - map of exported name -> value
 */

export async function loadModule(importPath, importerPath, parse, makeInterpreter) {
    // Absolute path of the import
    const absolutePath = resolve(dirname(importerPath), importPath);

    // if module is exportted, we get it from the cache
    if (moduleCache.has(absolutePath)) {
        return moduleCache.get(absolutePath);
    }

    // cicular inmport prevention
    if (loadingSet.has(absolutePath)) {
        throw new RuntimeError(
            `Circular import detected: "${absolutePath}" is already being loaded`
        );
    }

    loadingSet.add(absolutePath);

    // try to load module
    let source;
    try {
        source = readFileSync(absolutePath, "utf8");
    } catch {
        throw new RuntimeError(`Cannot find module "${importPath}" (resolved to "${absolutePath}")`);
    }
/// Next we try to parse the module
}

/**
 * Clears the module cache. Call this between test runs.
 */
export function clearModuleCache() {
    moduleCache.clear();
    loadingSet.clear();
}