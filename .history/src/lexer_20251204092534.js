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
        this.currentChar = this.currentChar < this.code.length? code[this.position]:null;
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
    // i am coming back to fix this method
    isNumber(){
        let number = "";
        while(this.currentChar && NUMBER_RGX.test(this.currentChar)) 
    }
    
};