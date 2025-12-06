// #### Kova-lexer ####
import { KEYWORDS, SINGLE_OPS, PSYMBOLS} from "../lib/constants/store";
import { LETTER_RGX, WHITESPACE_RGX, NUMBER_RGX,OP_RGX } from "../lib/regex";

export default class Lexer {
    constructor(code){
        this.code = code;
        this.position = 0;
        this.currentChar = code[0];
    }
    // #### Helper functions ####
    advance(){
        this.position++;
        this.currentChar = this.position < this.code.length? this.code[this.position]:null;
    };

    peek(){
       if(this.position + 1 >= this.code.length){
        return null
       }
        return this.code[this.position + 1] 
    };

    skipWhiteSpace(){
        while(this.currentChar && WHITESPACE_RGX.test(this.currentChar)){
            this.advance();
        }
    }

    readNumber(){
        let number = "";
        while(this.currentChar && NUMBER_RGX.test(this.currentChar)) {
            number += this.currentChar;
            this.advance();
        }
        return {type:"NUMBER", value:Number(number)}
    }

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

    readIdentifierOrKeyword(){
        let text = "";
        if(this.currentChar && !LETTER_RGX.test(this.currentChar)){
            throw new Error("A number type cannot start IDENTIFIER name")
        }
        while ( this.currentChar && (LETTER_RGX.test(this.currentChar) || NUMBER_RGX.test(this.currentChar))){
            text += this.currentChar;
            this.advance();
        }
        // #### in the case where by text string collected == order ####
        // if(this.currentChar && text === "order" && this.currentChar === "_"){
        //     while(this.currentChar && LETTER_RGX.test(this.currentChar)){
        //         text += this.currentChar;
        //         this.advance();
        //     }
        // }
        // #### Filter for keywords first [case-sensitive] ####
        if(text && KEYWORDS[text]){
        // #### boolean literals as keywords too (explicit token)
            if (text === "true" || text === "false") {
            return { type: "BOOLEAN", value: text === "true" };
            }
            return {type:KEYWORDS[text], value:text}
        }
        // #### return identifier 
        return {type:"IDENTIFIER", value:text}
    }

    readOperator(){
        // #### Comparison ####
        if(this.currentChar === "=" && this.peek() === "=") {
            this.advance();
            this.advance();
            return { type: "EQ", value: "==" };
        }
        if(this.currentChar === "!" && this.peek() === "=") {
            this.advance();
            this.advance();
            return { type: "NEQ", value: "!=" };
        }
        if(this.currentChar === "<" && this.peek() === "=") {
            this.advance();
            this.advance();
            return { type: "LTEQ", value: "<=" };
        }
        if(this.currentChar === ">" && this.peek() === "=") {
            this.advance();
            this.advance();
            return { type: "GTEQ", value: ">=" };
        }
        // #### Logical operators ####
        if(this.currentChar === "&" && this.peek() === "&") {
            this.advance(); 
            this.advance();
            return { type: "AND", value: "&&" };
        }
        if(this.currentChar === "|" && this.peek() === "|") {
            this.advance(); 
            this.advance();
            return { type: "OR", value: "||" };
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
            
            // #### Check for space ####
            this.skipWhiteSpace();
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
                tokens.push(this.readOperator())
                continue;
            }
            //Check for other programming symbols
            if(PSYMBOLS[this.currentChar]){
                tokens.push(this.readProgramSymbols())
                continue;
            }
            // if char does not match any ####
            throw new Error(`Unexpected character: ${this.currentChar}`);
        }
        tokens.push({ type: "EOF", value: null });
        return tokens;
    }
}        