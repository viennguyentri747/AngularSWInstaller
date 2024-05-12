// import path from "path";
import dotenv from "dotenv";

// Parsing the env file.
dotenv.config({ path: "./configs/config.env" });

// Interface to load env variables
interface ENV {
    GIT_ACCESS_KEY: string | undefined;
}

const getEnvCfg = (): ENV => {
    let myEnv: ENV = {
        GIT_ACCESS_KEY: process.env.GIT_PRIVATE_ACCESS_TOKEN
    };

    for (const [key, value] of Object.entries(myEnv)) {
        if (value === undefined) {
            throw new Error(`Missing key ${key} in config.env`);
        }
    }

    return myEnv;
};

const envCfg: ENV = getEnvCfg();
export default envCfg;
