import { stubAI, resolveProb } from "../../src/ai/groq.js";



// #### Default Externals and Signatures

export const defaultExternals = {
    AI:      (task, input, schema = null) => stubAI(task, input, schema),
    resolve: resolveProb,
    log: (...args) => { console.log("[kova:log]", ...args); return null; },
    env: (key) => process.env[key] ?? null,
    floor: Math.floor, ceil: Math.ceil, round: Math.round,
    abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow,
    max: Math.max, min: Math.min, random: Math.random,
    trim:   (s) => String(s).trim(),
    upper:  (s) => String(s).toUpperCase(),
    lower:  (s) => String(s).toLowerCase(),
    split:  (s, sep) => String(s).split(sep),
    join:   (arr, sep) => arr.join(sep ?? ","),
    concat: (...args) => args.join(""),
    flat:   (arr) => arr.flat(),
    unique: (arr) => [...new Set(arr)],
    sort:   (arr) => [...arr].sort(),
    parseJSON: (s) => JSON.parse(s),
    toJSON:    (v) => JSON.stringify(v),
    now:       ()  => Date.now(),
    isoDate:   ()  => new Date().toISOString(),
};

// default signatures for type-checking built-in functions
export const defaultSignatures = {
    AI:      { params: ["string", "any"],           returns: "unknown"    },
    resolve: { params: ["prob"],                    returns: "unknown" },
    log:     { params: ["any"],                     returns: "null"    },
    env:     { params: ["string"],                  returns: "string"  },
    floor:   { params: ["number"],                  returns: "number"  },
    ceil:    { params: ["number"],                  returns: "number"  },
    round:   { params: ["number"],                  returns: "number"  },
    abs:     { params: ["number"],                  returns: "number"  },
    sqrt:    { params: ["number"],                  returns: "number"  },
    pow:     { params: ["number", "number"],        returns: "number"  },
    max:     { params: ["number", "number"],        returns: "number"  },
    min:     { params: ["number", "number"],        returns: "number"  },
    random:  { params: [],                          returns: "number"  },
    trim:    { params: ["string"],                  returns: "string"  },
    upper:   { params: ["string"],                  returns: "string"  },
    lower:   { params: ["string"],                  returns: "string"  },
    parseJSON: { params: ["string"],                returns: "object"  },
    toJSON:    { params: ["any"],                   returns: "string"  },
    now:       { params: [],                        returns: "number"  },
    isoDate:   { params: [],                        returns: "string"  },
    range:     { params: ["number", "number"],      returns: "array"   },
    toString:  { params: ["any"],                   returns: "string"  },
    toNumber:  { params: ["any"],                   returns: "number"  },
    typeOf:    { params: ["any"],                   returns: "string"  },
    concat:    { params: ["any", "any"],            returns: "string"  },
    split:     { params: ["string", "string"],      returns: "array"   },
    join:      { params: ["array", "string"],       returns: "string"  },
    flat:      { params: ["array"],                 returns: "array"   },
    unique:    { params: ["array"],                 returns: "array"   },
    sort:      { params: ["array"],                 returns: "array"   },
};