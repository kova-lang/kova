// ##### Keywords #####

export const KEYWORDS = {
    // ##### Runtime #####
    let: "LET",
    fn: "FN",
    return: "RETURN",
    export: "EXPORT",

    // ##### Imports #####
    import: "IMPORT",
    from: "FROM",

    // ##### Control flow #####
    if: "IF",
    else: "ELSE",
    while: "WHILE",
    for: "FOR",
    in: "IN",

    // ##### HTTP verbs #####
    GET: "GET_HTTP",
    POST: "POST_HTTP",
    PUT: "PUT_HTTP",
    DELETE: "DELETE_HTTP",
    PATCH: "PATCH_HTTP",

    // ##### HTTP / query result binding #####
    into: "INTO",
    save: "SAVE",

    // ##### Database #####
    connect: "CONNECT",
    using: "USING",
    find: "FIND",
    insert: "INSERT",
    update: "UPDATE",
    where: "WHERE",
    set: "SET",
    limit: "LIMIT",
    order_by: "ORDER_BY",
    asc: "ASC",
    desc: "DESC",

    // ##### Response #####
    respond: "RESPOND",

    // ##### Environment #####
    ENV: "ENV",

    // ##### Literals #####
    true: "BOOLEAN",
    false: "BOOLEAN",
    null: "NULL",
};

// ##### Single-character operators #####
export const SINGLE_OPS = {
    "+": "PLUS",
    "-": "MINUS",
    "*": "STAR",
    "/": "SLASH",
    "=": "ASSIGN",
    ">": "GT",
    "<": "LT",
    "!": "BANG",
    "%": "PERCENT",
};

// ##### Multi-character operators #####
export const MULTI_OPS = {
    "==": "EQ",
    "!=": "NEQ",
    ">=": "GTE",
    "<=": "LTE",
    "&&": "AND",
    "||": "OR",
    "=>": "ARROW",
    "+=": "PLUS_ASSIGN",
    "-=": "MINUS_ASSIGN",
    "*=": "STAR_ASSIGN",
    "/=": "SLASH_ASSIGN",
};

// ##### Punctuation / structural symbols #####
export const PSYMBOLS = {
    "(": "LPAREN",
    ")": "RPAREN",
    "{": "LBRACE",
    "}": "RBRACE",
    "[": "LBRACKET",
    "]": "RBRACKET",
    ",": "COMMA",
    ".": "DOT",
    ":": "COLON",
    ";": "SEMICOLON",
};


// ##### Escape map #####
export const ESCAPE_MAP = {
    n: "\n",
    t: "\t",
    r: "\r",
    "\\": "\\",
    '"': '"',
    "'": "'",
};

// #### Assign operators ####
export const ASSIGN_OPS = ["ASSIGN", "PLUS_ASSIGN", "MINUS_ASSIGN", "STAR_ASSIGN", "SLASH_ASSIGN"];

// #### Literal types ####
export const LITERAL_TYPES = new Set(["NUMBER", "STRING", "BOOLEAN", "NULL"]);

// #### HTTP Methods ####
export const HTTP = ["GET_HTTP", "POST_HTTP", "PUT_HTTP", "DELETE_HTTP", "PATCH_HTTP"];

/**
Contextual keywords: when used as a value (not at statement position), keywords like `update`, `limit`, `set`, `find`, `insert`, `where`, `respond` are valid variable names. Treat them as identifiers here. 
*/ 
export const CONTEXTUAL_KW_TYPES = new Set([
    "UPDATE", "FIND", "INSERT", "SET", "LIMIT", "WHERE", "ORDER_BY",
    "ASC", "DESC", "RESPOND", "CONNECT", "USING", "SAVE", "INTO", "FROM"
]);


