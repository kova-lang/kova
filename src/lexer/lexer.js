import {
    KEYWORDS,
    SINGLE_OPS,
    PSYMBOLS,
    MULTI_OPS,
} from "../../lib/constants/store.js";
import {
    LETTER_RGX,
    NUMBER_RGX,
    OP_RGX,
} from "../../lib/regex/index.js";

export default class Lexer {
    constructor(code) {
        this.code = code || "";
        this.position = 0;
        this.currentChar = this.code.length ? this.code[0] : null;
        this.line = 1;
        this.column = 1;
    }

    advance() {
        if (this.currentChar === "\n") {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.position++;
        this.currentChar =
            this.position < this.code.length ? this.code[this.position] : null;
    }

    peek(offset = 1) {
        const pos = this.position + offset;
        return pos < this.code.length ? this.code[pos] : null;
    }

    skipIgnorable() {
        while (this.currentChar !== null) {
            if ([" ", "\t", "\r", "\n"].includes(this.currentChar)) {
                this.advance();
                continue;
            }
            // # comment
            if (this.currentChar === "#") {
                while (this.currentChar !== "\n" && this.currentChar !== null)
                    this.advance();
                continue;
            }
            // // comment
            if (this.currentChar === "/" && this.peek() === "/") {
                this.advance();
                this.advance();
                while (this.currentChar !== "\n" && this.currentChar !== null)
                    this.advance();
                continue;
            }
            // /* block comment */
            if (this.currentChar === "/" && this.peek() === "*") {
                this.advance();
                this.advance();
                while (
                    this.currentChar !== null &&
                    !(this.currentChar === "*" && this.peek() === "/")
                ) {
                    this.advance();
                }
                if (this.currentChar !== null) {
                    this.advance(); // *
                    this.advance(); // /
                }
                continue;
            }
            break;
        }
    }

    readNumber() {
        let number = "";
        let isFloat = false;
        const line = this.line;
        const column = this.column;

        while (this.currentChar && NUMBER_RGX.test(this.currentChar)) {
            number += this.currentChar;
            this.advance();
        }

        // float support: 3.14
        if (this.currentChar === "." && this.peek() && NUMBER_RGX.test(this.peek())) {
            isFloat = true;
            number += this.currentChar;
            this.advance();
            while (this.currentChar && NUMBER_RGX.test(this.currentChar)) {
                number += this.currentChar;
                this.advance();
            }
        }

        if (this.currentChar && LETTER_RGX.test(this.currentChar)) {
            throw new Error(
                `Invalid identifier: identifiers cannot start with a number (${number}${this.currentChar}...)`
            );
        }

        return { type: "NUMBER", value: Number(number), float: isFloat, line, column };
    }

    readString(quote = '"') {
        let string = "";
        const line = this.line;
        const column = this.column;
        this.advance(); // opening quote

        while (this.currentChar && this.currentChar !== quote) {
            // escape sequences
            if (this.currentChar === "\\") {
                this.advance();
                const escapes = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" };
                string += escapes[this.currentChar] ?? this.currentChar;
            } else {
                string += this.currentChar;
            }
            this.advance();
        }

        if (this.currentChar !== quote) {
            throw new Error(`Unterminated string literal starting at line ${line}`);
        }
        this.advance(); // closing quote
        return { type: "STRING", value: string, line, column };
    }

    readIdentifierOrKeyword() {
        let text = "";
        const line = this.line;
        const column = this.column;

        while (
            this.currentChar &&
            (LETTER_RGX.test(this.currentChar) || NUMBER_RGX.test(this.currentChar))
        ) {
            text += this.currentChar;
            this.advance();
        }

        if (text === "true" || text === "false") {
            return { type: "BOOLEAN", value: text === "true", line, column };
        }
        if (text === "null") {
            return { type: "NULL", value: null, line, column };
        }
        if (Object.prototype.hasOwnProperty.call(KEYWORDS, text)) {
            return { type: KEYWORDS[text], value: text, line, column };
        }
        return { type: "IDENTIFIER", value: text, line, column };
    }

    readOperator() {
        const twoCharOp = this.currentChar + this.peek();
        if (MULTI_OPS[twoCharOp]) {
            const line = this.line;
            const column = this.column;
            this.advance();
            this.advance();
            return { type: MULTI_OPS[twoCharOp], value: twoCharOp, line, column };
        }
        if (SINGLE_OPS[this.currentChar]) {
            const line = this.line;
            const column = this.column;
            const value = this.currentChar;
            this.advance();
            return { type: SINGLE_OPS[value], value, line, column };
        }
        return null;
    }

    readProgramSymbols() {
        if (this.currentChar && PSYMBOLS[this.currentChar]) {
            const line = this.line;
            const column = this.column;
            const value = this.currentChar;
            this.advance();
            return { type: PSYMBOLS[value], value, line, column };
        }
        return null;
    }

    tokenize() {
        const tokens = [];

        while (this.currentChar !== null) {
            this.skipIgnorable();
            if (this.currentChar === null) break;

            if (NUMBER_RGX.test(this.currentChar)) {
                tokens.push(this.readNumber());
                continue;
            }
            if (this.currentChar === '"' || this.currentChar === "'") {
                tokens.push(this.readString(this.currentChar));
                continue;
            }
            if (LETTER_RGX.test(this.currentChar)) {
                tokens.push(this.readIdentifierOrKeyword());
                continue;
            }
            if (OP_RGX.test(this.currentChar)) {
                const op = this.readOperator();
                if (!op) throw new Error(`Unexpected operator: ${this.currentChar}`);
                tokens.push(op);
                continue;
            }
            if (PSYMBOLS[this.currentChar]) {
                tokens.push(this.readProgramSymbols());
                continue;
            }

            throw new Error(
                `Unexpected character '${this.currentChar}' at line ${this.line}, column ${this.column}`
            );
        }

        tokens.push({ type: "EOF", value: null });
        return tokens;
    }
}
