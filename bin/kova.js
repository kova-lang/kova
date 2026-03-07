#!/usr/bin/env node

/**
 * Kova CLI
 * Usage:
 *   kova run <file.kova>         —> run a Kova program
 *   kova run <file.kova> --graph —> run and print execution graph summary
 *   kova check <file.kova>       —> parse and type-check only
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runKova, parseKova } from "../src/index.js";

const [,, command, filePath, ...flags] = process.argv;

const help = `
Kova v0.5 : symbolic AI workflow language

Usage:
  kova run <file.kova>           Run a Kova program
  kova run <file.kova> --graph   Run and display execution graph
  kova check <file.kova>         Parse and type-check without running
  kova help                      Show this message

Examples:
  kova run examples/sentiment.kova
  kova run examples/pipeline.kova --graph
  kova check examples/api.kova
`;

if (!command || command === "help" || command === "--help") {
    console.log(help);
    process.exit(0);
}

if (!filePath && command !== "help") {
    console.error("Error: no file specified.");
    console.log(help);
    process.exit(1);
}

const absPath = resolve(process.cwd(), filePath);
let code;

try {
    code = readFileSync(absPath, "utf8");
} catch (e) {
    console.error(`Error: could not read file "${filePath}"`);
    process.exit(1);
}

if (command === "check") {
    try {
        const { ast } = parseKova(code);
        const nodeCount = JSON.stringify(ast).split('"type"').length - 1;
        console.log(`OK  ${filePath}  (${nodeCount} AST nodes)`);
    } catch (err) {
        console.error(err.formatted ?? err.message);
        process.exit(1);
    }

} else if (command === "run") {
    try {
        const result = await runKova(code);

        if (result.output.length > 0) result.output.forEach(line => console.log(line));

        if (result.respondValue) {
            console.log("\n[respond]", JSON.stringify(result.respondValue, null, 2));
        }

        if (result.returnValue !== undefined) {
            console.log("\n[return]", result.returnValue);
        }

        if (flags.includes("--graph")) {
            const g = result.graph;
            console.log("\n #### Execution Graph  ####");
            console.log(`   Nodes      : ${g.json.nodes.length}`);
            console.log(`   Edges      : ${g.json.edges.length}`);
            console.log(`   AI nodes   : ${g.json.nodes.filter(n => n.kind === "ai").length}`);
            console.log(`   Resolved   : ${g.json.nodes.filter(n => n.kind === "resolve_prob").length}`);
            console.log(`   Topological order:`);
            g.topologicalOrder.forEach((id, i) => {
                const node = g.json.nodes.find(n => n.id === id);
                if (node) console.log(`     ${i + 1}. [${node.kind}] ${node.label.split("\n")[0]}`);
            });
            if (g.parallelCandidates.length > 0) {
                console.log(`   Parallel candidates: ${g.parallelCandidates.map(p => p.join(" || ")).join(", ")}`);
            }
        }

    } catch (err) {
        console.error(err.formatted ?? err.message);
        process.exit(1);
    }

} else {
    console.error(`Unknown command: "${command}"`);
    console.log(help);
    process.exit(1);
}