// #### constants ####

// Keywords
export const KEYWORDS = {
    // #### RUNTIME KWS ####
    "let":"LET",
    "import":"IMPORT",
    "from":"FROM",
    "env":"ENV",
    "respond":"RESPOND",
    // #### HTTP kWS ####
    "GET":"GET_HTTP",
    "POST":"POST_HTTP",
    "PUT":"PUT_HTTP",
    "DELETE":"DELETE_HTTP",
    // #### DB & QUERY KWS ####
    "find":"FIND",
    "insert":"INSERT",
    "update":"UPDATE",
    "delete":"DELETE",
    "into":"INTO",
    "set":"SET",
    "where":"WHERE",
    "limit":"LIMIT",
    "order_by":"ORDER_BY",
    "asc":"ASC",
    "desc":"DESC"
}

// #### Single Operators ####
export const SINGLE_OPS = {
  "+": "PLUS",
  "-": "MINUS",
  "*": "STAR",
  "/": "SLASH",
  "=": "EQUAL",
  "<": "LESS",
  ">": "GREATER"
};

export const PSYMBOLS = {
  "{": "LBRACE",
  "}": "RBRACE",
  "(": "LPAREN",
  ")": "RPAREN",
  ","
};


// #### REGEX ####

export const WHITESPACE_RGX = /\S/;
export const NUMBER_RGX = /[0-9]/;
export const LETTER_RGX = /[A-Za-z_]/;