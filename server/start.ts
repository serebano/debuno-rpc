import path from "node:path";
import process from "node:process";
import { serve } from "./index.ts";
import { fileExists, mapToSet } from "../utils/mod.ts";



export async function start(configFile?: string) {
    if (!configFile) {

        const denoConfigFile = path.join(process.cwd(), 'deno.json');
        const rpcConfigFile = path.join(process.cwd(), 'rpc.json');

        if (await fileExists(rpcConfigFile))
            return start(rpcConfigFile);

        if (await fileExists(denoConfigFile))
            return start(denoConfigFile);

        throw new TypeError(`Missing config file at path: ${process.cwd()}, deno.json or rpc.json required`);
    }

    const denoConfig = await import(configFile, { with: { type: 'json' } });
    const rpcmap = denoConfig.default.rpc as Record<string, string>;

    if (rpcmap) {
        const rpcset = mapToSet(rpcmap);
        const server = await serve(...rpcset);

        return {
            server,
            rpcmap,
            rpcset,
            config: configFile
        };
    }

    throw new TypeError(`Missing config.rpc mappings at: ${configFile}`);
}
