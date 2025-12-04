// Kova-lexer
import { KEYWORDS, SINGLE_OPS} from "../lib/constants/store";
import { LETTER_RGX, WHITESPACE_RGX, NUMBER_RGX } from "../lib/regex";

export default class Lexer {
    constructor(code){
        this.code = code;
        this.position = 0;
        this.currentChar = input[0];
    }
    // #### Helper functions ####
    advance(){
        this.position++;
        this.currentChar = this.position < this.code.length? code[this.position]:null;
    };

    peek(){
       if(this.position + 1 >= this.code.length){
        return null
       }
       else{
        return code[this.position + 1]
       }
    };

    skipWhiteSpace(){
        if(this.currentChar && WHITESPACE_RGX.test(this.currentChar)){
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
        this.advance();
        return {type:"STRING", value:string}
    }

    readIdentifierorkeyword(){
        let text = "";
        if(this.currentChar && !LETTER_RGX.test(this.currentChar)){
            throw new Error("A number type cannot start IDENTIFIER name")
        }
        while(this.current && LETTER_RGX.test(this.currentChar) || NUMBER_RGX.test(this.currentChar)){
            text += this.currentChar;
            this.advance();
        }
        // #### in the case where by text string collected == order ####
        if(this.currentChar && text === "order" && this.currentChar === "_"){
            while(this.current && LETTER_RGX.test(this.currentChar)){
                test += this.currentChar;
                this.advance();
            }
        }
        // #### Filter for keywords first [case-sensitive] ####
        if(text && KEYWORDS[text]){
            return {type:KEYWORDS[text], value:text}
        }
        // #### return identifier 
        return {type:"IDENTIFIER", value:text}
    }

    readOperator(){
        // #### Comparison ####
        if(this.current === "=" && this.peek() === "=") {
            this.advance();
            this.advance();
            return { type: "EQ", value: "==" };
        }
        if(this.current === "!" && this.peek() === "=") {
            this.advance();
            this.advance();
            return { type: "NEQ", value: "!=" };
        }
        if(this.current === "<" && this.peek() === "=") {
            this.advance();
            this.advance();
            return { type: "LTEQ", value: "<=" };
        }
        if(this.current === ">" && this.peek() === "=") {
            this.advance();
            this.advance();
            return { type: "GTEQ", value: ">=" };
        }
        // #### Logical operators ####
        if(this.current === "&" && this.peek() === "&") {
            this.advance(); 
            this.advance();
            return { type: "AND", value: "&&" };
        }
        if(this.current === "|" && this.peek() === "|") {
            this.advance(); 
            this.advance();
            return { type: "OR", value: "||" };
        }
        // #### Single operators
        if(SINGLE_OPS[this.currentChar]){
            let oper = SINGLE_OPS[this.currentChar];
            this.advance();
            return {type:}
        }
    }
}        