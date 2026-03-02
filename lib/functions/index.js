export const defaultExternals = {
    AI: (task, input) => `[AI:${task}] ${input}`
};

export const defaultSignatures = {
    AI: {
        params: ["string", "number"],
        returns: "string"
    }
};