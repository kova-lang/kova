import { runKova } from "../src/index.js";

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
        let x = 5
        if x > 3 {
            return 10
        }
        return 0
    `);

    console.log(result.returnValue === 10);
}

function testHttpMock() {
    const result = runKova(`
        POST "https://example.com"
    `);

    console.log(result.output.length === 1);
}


testSemanticValid();
testSemanticUndeclared();
testSemanticDuplicate();
testHttpMock();