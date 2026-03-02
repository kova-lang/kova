import { Diagnostic } from "../../src/core/diagnostic.js";

export const defaultExternals = {
    AI: (task, input) => `[AI:${task}] ${input}`
};

export const defaultSignatures = {
    AI: {
        params: ["string", "number"],
        returns: "string"
    }
};


// error helper

export const error = (message, node) =>{
    throw new Diagnostic(message, node, this.source)
};