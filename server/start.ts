import path from "node:path";
import process from "node:process";
import { serve } from "./serve.ts";
import { fileExists, mapToSet } from "../utils/mod.ts";

export async function resolveRC(file?: string): Promise<string> {
    if (!file) {
        const cwd = process.cwd()

        const denoConfigFile = path.join(cwd, 'deno.json');
        const rpcConfigFile = path.join(cwd, 'rpc.json');

        if (await fileExists(rpcConfigFile))
            return resolveRC(rpcConfigFile);

        if (await fileExists(denoConfigFile))
            return resolveRC(denoConfigFile);

        throw new TypeError(`Missing config file at path: ${cwd}, deno.json or rpc.json required`);
    }

    return file
}

export async function loadRC(filePath?: string) {

    const resolvedFilePath = await resolveRC(filePath);
    const { default: config } = await import(resolvedFilePath, { with: { type: 'json' } });

    const map = config.rpc as Record<string, string>;

    if (!map)
        throw new TypeError(`Missing config.rpc mappings at: ${resolvedFilePath}`);

    return mapToSet(map).map(server => ({ server }))
}


export async function start(rcFilePath?: string) {
    const config = (await loadRC(rcFilePath))
    const server = await serve(config);

    return {
        config,
        server
    }
}
