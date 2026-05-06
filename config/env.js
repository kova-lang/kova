import dotenv from "dotenv";
dotenv.config();

const require = (config_name) => {
    let key = process.env[config_name];
    if(!key){
        throw new Error(`Missing required environment variable: ${config_name}`)
    }
    return key;
}

export const env = {
GROQ_API_KEY: require("GROQ_API_KEY")
}