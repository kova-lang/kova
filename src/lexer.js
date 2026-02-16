// #### Kova-lexer ####
import { KEYWORDS, SINGLE_OPS, PSYMBOLS, MULTI_OPS} from "../lib/constants/store.js";
import { LETTER_RGX, WHITESPACE_RGX, NUMBER_RGX,OP_RGX } from "../lib/regex/index.js";

export default class Lexer {
    constructor(code){
        this.code = code || ""; // The source code to be tokenized
        this.position = 0; // Current position in the source code 
        this.currentChar = this.code.length ? this.code[0] : null; // Current character being analyzed
    }

    // Move to the next character in the source code 
    advance(){
        this.position++;
        this.currentChar = this.position < this.code.length? this.code[this.position]:null;
    };
    // Lookahead function to peek at the next character without adavcning the position
    peek(){
       if(this.position + 1 >= this.code.length){
        return null
       }
        return this.code[this.position + 1] 
    };
    
    // Unified skip for whitespace and comments
skipIgnorable() {
    while (this.currentChar !== null) {

        // Skip spaces, tabs, carriage returns, newlines
        if (this.currentChar === " " || this.currentChar === "\t" || this.currentChar === "\r" || this.currentChar === "\n") {
            this.advance();
            continue;
        }

        // Skip hash-style comment
        if (this.currentChar === "#") {
            this.advance(); // skip '#'
            while (this.currentChar !== "\n" && this.currentChar !== null) {
                this.advance(); // skip comment content
            }
            continue; // will skip newline on next iteration
        }

        // Skip double-slash comment
        if (this.currentChar === "/" && this.peek() === "/") {
            this.advance(); // skip first '/'
            this.advance(); // skip second '/'
            while (this.currentChar !== "\n" && this.currentChar !== null) {
                this.advance(); // skip comment content
            }
            continue; // newline will be skipped in next iteration
        }

        // If none of the above, stop skipping
        break;
    }
}

    //  Read a number token from the source code
    readNumber(){
        let number = "";
        while(this.currentChar && NUMBER_RGX.test(this.currentChar)) {
            number += this.currentChar;
            this.advance();
        }
        // INVALID: number immediately followed by identifier start
        if (this.currentChar && LETTER_RGX.test(this.currentChar)) {
            throw new Error(
            `Invalid identifier: identifiers cannot start with a number (${number}${this.currentChar}...)`
        );
    }
        return {type:"NUMBER", value:Number(number)}
    }
    // Read a string token from the source code
    readString(){
        let string =""
        this.advance();
        while(this.currentChar && this.currentChar !=='"'){
            string += this.currentChar;
            this.advance();
        }
        if(this.currentChar !== '"'){
            throw new Error('Expected ["] at the closing of the string value ')
        }
        this.advance();
        return {type:"STRING", value:string}
    }

    // Read an identifier or keyword from the source code
    readIdentifierOrKeyword(){
        let text = "";
        
        while ( this.currentChar && (LETTER_RGX.test(this.currentChar) || NUMBER_RGX.test(this.currentChar))){
            text += this.currentChar;
            this.advance();
        }
        // #### check if the text is a boolean ####
        if (text === "true" || text === "false") {
                return { type: "BOOLEAN", value: text === "true" };
        }
        // #### check if the text is a keyword ####
        if(text && KEYWORDS[text]){
      
            return {type:KEYWORDS[text], value:text}
        }
        // #### return identifier 
        return {type:"IDENTIFIER", value:text}
    }

    readOperator(){
        const twoCharOp = this.currentChar + this.peek();
        // #### Check for multiple operators ####
        if(MULTI_OPS[twoCharOp]){
            let value = twoCharOp;
            let type = MULTI_OPS[twoCharOp];
            this.advance();
            this.advance();
            return {type, value}
        }
       
        // #### Single operators ####
        if(SINGLE_OPS[this.currentChar]){
            let value = this.currentChar;
            let type = SINGLE_OPS[this.currentChar] ;
            this.advance();
            return {type, value}
        }
        return null;    
    }
    readProgramSymbols(){
        if(this.currentChar && PSYMBOLS[this.currentChar]){
            let value = this.currentChar;
            let type = PSYMBOLS[this.currentChar];
            this.advance();
            return {type, value}
        }
        return null;
    }
    tokenize(){
        const tokens = [];
        while(this.currentChar !== null){
            
            // #### Check Ignorables ####
            this.skipIgnorable()
            if (this.currentChar === null) break;
    
            if (this.currentChar === null) break;
            // #### Check for number ####
            if(NUMBER_RGX.test(this.currentChar)){
                tokens.push(this.readNumber())
                continue;
            }
            // #### Check for string ####
            if(this.currentChar === '"'){
                tokens.push(this.readString())
                continue;
            }
            // #### Check for Identifier or keywords ####
            if (LETTER_RGX.test(this.currentChar)) {
                tokens.push(this.readIdentifierOrKeyword());
                continue;
            }
            // #### Check for operator ####
            if(OP_RGX.test(this.currentChar)){
                const opToken = this.readOperator();
                if(!opToken){
                    throw new Error(`Unexpected operator sequence: ${this.currentChar}`);
                }
                tokens.push(opToken);
                continue;
            }
            // #### Check for other programming symbols ####
            if(PSYMBOLS[this.currentChar]){
                tokens.push(this.readProgramSymbols())
                continue;
            }
            // #### if char does not match any ####
            throw new Error(`Unexpected character: ${this.currentChar}`);
        }
        tokens.push({ type: "EOF", value: null });
        return tokens;
    }
}        