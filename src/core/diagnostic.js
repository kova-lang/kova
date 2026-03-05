export class Diagnostic extends Error {
    constructor(message, node, source = null) {
        const location =
            node?.line !== undefined
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
            return `${this.name}: ${this.messageOnly}`;
        }

        const lines = this.source.split("\n");
        const codeLine = lines[this.line - 1] || "";
        const col = Math.max(0, (this.column ?? 1) - 1);
        const pointer = " ".repeat(col) + "^";
        const lineLabel = String(this.line).padStart(4);

        return (
            `\n${this.name}: ${this.messageOnly}\n` +
            `--> Line ${this.line}, Column ${this.column}\n\n` +
            `${lineLabel} | ${codeLine}\n` +
            `       ${pointer}\n`
        );
    }
}

export class RuntimeError extends Error {
    constructor(message, node = null) {
        super(message);
        this.name = "KovaRuntimeError";
        this.line = node?.line ?? null;
        this.column = node?.column ?? null;
    }
}
