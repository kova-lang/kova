// Parser.js

// #### main parser class ####
export default class Parser {
   constructor(lexer){
    this.lexer = lexer;
    this.currentPos = lexer.length?0:-1;
    this.currentToken = lexer.length? lexer[0]: null;
       }

    // #### Advance to the next token in the token stream ####
    advance(){
        this.currentPos++;
        this.currentToken = this.currentPos < this.lexer.length? this.lexer[this.currentPos]: null;
    }

    // #### Expect a specific token type and advance if it matches, otherwise throw an error ####
    expect(type){
        if( this.currentToken === null ||this.currentToken !== type){
            throw new Error(`Expected ${type} but got ${this.currentToken.type}`)
        }
        this.advance();
    };
};