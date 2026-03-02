export class Diagnostic extends Error {
    constructor(message, node, source = null) {
        const location = node?.line !== undefined
            ? `Line ${node.line}, Column ${node.column}`
            : "Unknown location";

        super(`${message} at ${location}`);

        this.name = "KovaSemanticError";
        this.messageOnly = message;
        this.line = node?.line ?? null;
        this.column = node?.column ?? null;
        this.source = source;
    }

    format() {
        if (!this.source || this.line == null) {
            return this.message;
        }

        const lines = this.source.split("\n");
        const codeLine = lines[this.line - 1] || "";

        const pointer = " ".repeat(this.column - 1) + "^";

        return `
${this.name}: ${this.messageOnly}
--> Line ${this.line}, Column ${this.column}

${codeLine}
${pointer}
`;
    }
}