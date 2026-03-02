import { runKova } from "../src/index.js";
import { defaultExternals, defaultSignatures } from "../lib/functions/index.js";


function testSemanticValid() {
    const code = `
        let x = 5
        let y = x + 2
    `;

    runKova(code);
    console.log("Semantic valid test passed");
}

function testSemanticUndeclared() {
    const code = `
        let y = x + 2
    `;

    try {
        runKova(code);
    } catch (e) {
        console.log("Undeclared variable test passed");
    }
}

function testSemanticDuplicate() {
    const code = `
        let x = 5
        let x = 10
    `;

    try {
        runKova(code);
    } catch (e) {
        console.log("Duplicate declaration test passed");
    }
}

function testArithmetic() {
    const result = runKova(`
        let x = 5 + 2
        return x
    `);

    console.log(result.returnValue === 7);
}

function testIf() {
    const result = runKova(`
        let x = 2
if x > 3 {
    return 10
}
else if (x == 2) {
    return 2
}
else {
    return 0
}
    `);
    console.log(result.returnValue)
    console.log(result.returnValue === 2);
}

function testHttpMock() {
    const result = runKova(`
        POST "https://example.com"
    `);

    console.log(result.output.length === 1);
}

function testFunctionCall() {
    const result = runKova(`
        let x = 3
        let y = AI("summarize", x)
        return y
    `,
        defaultExternals,
        defaultSignatures);

    console.log(result.returnValue);
}


testSemanticValid();
testSemanticUndeclared();
testSemanticDuplicate();
testHttpMock();
testArithmetic();
testFunctionCall();
testIf();
