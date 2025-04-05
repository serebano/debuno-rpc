// deno-lint-ignore-file no-process-global
import { mkdir, rm } from "node:fs/promises";
import { fileExists, formatBase, getDenoConfig, groupByDeep, mapToSet, resolvePath } from "../utils/mod.ts";
import type { ConfigInit, Config, ConfigInitMap } from "../types/config.ts";
import path, { join, resolve } from "node:path";

export const RPC_DIR = process.env.RPC_DIR || process.env.HOME + '/.rpc'
export const RPC_GEN_DIR = RPC_DIR + '/gen'
export const RPC_LIB_DIR = RPC_GEN_DIR + '/lib'
export const RPC_PRO_DIR = RPC_GEN_DIR + '/pro'

// await rm(RPC_DIR, { recursive: true, force: true })
await mkdir(RPC_DIR, { recursive: true });

// Define your types
type Input = Record<string, string>;

// Overloads
export function parseRC(input: Input, group: true): ConfigInitMap;
export function parseRC(input: Input, group?: false): ConfigInit[];

// Implementation
export function parseRC(input: Input, group: boolean = false): any {
    const inits: ConfigInit[] = mapToSet(input)
        .map(server => ({ server }));

    return group === true
        ? groupByDeep(inits, "server.$id")
        : inits;
}

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

export function defineConfig(init: ConfigInit): Config {
    init = { ...init }
    const server = init.server = init.server || {}

    server.path = server.path ? resolve(server.path) : process.cwd()
    server.port = Number(server.port || 0)
    server.base = formatBase(server.base)

    const client = init.client = init.client || {}

    client.base = formatBase(server.base + (client.base || '@client'))

    const denoConfig = getDenoConfig(server.path)

    const shared = init.shared = init.shared || {}

    shared.jsxImportUrl = shared.jsxImportUrl || denoConfig.compilerOptions?.jsxImportSource

    const config: Config = {
        get dev() {
            return init.dev === true
        },
        get server() {
            return server
        },
        get client() {
            return {
                base: client.base!,
                path: this.dev
                    ? resolvePath('../client', import.meta.url)
                    : resolvePath('../dist/client', import.meta.url)
                ,
                get rpcImportUrl() {
                    return this.base + 'rpc'
                },
                get hotImportUrl() {
                    return this.base + 'hot'
                },
                get envImportUrl() {
                    return this.base + 'env'
                }
            }
        },
        get shared() {
            return {
                jsxImportUrl: shared.jsxImportUrl
            }
        },
        get deno() {
            return denoConfig
        },
        get protocol() {
            return `web+rpc`
        },
        get rpcDir() {
            return join(this.server.path, '.rpc')
        },
        get genDir() {
            return join(this.rpcDir, 'gen')
        },
        get srcKey() {
            return `src`
        },
        get genKey() {
            return `gen`
        },
        getEnv(url) {
            return {
                DEV: this.dev,
                PATH: this.server.path,
                PORT: this.server.port,
                BASE: this.server.base,
                ORIGIN: new URL(String(url)).origin,
                BASE_URL: String(new URL(this.server.base, String(url)))
            }
        },
        filter: (file: string): boolean =>
            !file.includes('.rpc') &&
            !file.includes('node_modules') && (
                file.endsWith('.ts') ||
                file.endsWith('.d.ts') ||
                file.endsWith('.tsx') ||
                file.endsWith('.json') ||
                file.endsWith('.js') ||
                file.endsWith('.jsx') ||
                file.endsWith('.html') ||
                file.endsWith('.svg') ||
                file.endsWith('.css') ||
                file.endsWith('.txt') ||
                file.endsWith('.md') ||
                file.endsWith('.sh')
            )
    }

    // console.log(`path = ${config.server.path}`)
    // console.log(`port = ${config.server.port}`)
    // console.log(`base = ${config.server.base}`)
    // console.log(`dev = ${config.dev}`)

    return config
}