// deno-lint-ignore-file no-process-global
import { mkdir, rm } from "node:fs/promises";
import { fileExists, formatBase, getDenoConfig, groupByDeep, mapToSet, resolvePath } from "../utils/mod.ts";
import type { ConfigInit, Config, ConfigInitMap } from "../types/config.ts";
import path, { join, resolve } from "node:path";
import { createConsole, type ConsoleLevel } from "../utils/console.ts";

export const RPC_DIR = process.env.RPC_DIR || process.env.HOME + '/.rpc'
export const RPC_GEN_DIR = RPC_DIR + '/gen'
export const RPC_LIB_DIR = RPC_GEN_DIR + '/lib'
export const RPC_PRO_DIR = RPC_GEN_DIR + '/pro'

export const RC_FILE_NAMES = [
    'deno.json',
    'rpc.json',
    'rpc.config.json',
    'rpc.config.ts',
    'rpc.config.js'
]

export const RC_FILE_NAMES_PROP = {
    'deno.json': 'rpc',
    'rpc.json': null,
    'rpc.config.json': null,
    'rpc.config.ts': null,
    'rpc.config.js': null
}

// await rm(RPC_DIR, { recursive: true, force: true })
await mkdir(RPC_DIR, { recursive: true });


export async function tryRCFiles(rcFileNames: string[], debug?: ConsoleLevel): Promise<{ filePath: string, config: Record<string, string> }> {
    const console = createConsole('tryRCFiles', {
        level: debug
    })

    try {
        rcFileNames = [...new Set(rcFileNames.filter((file: string) => file.endsWith('.json') || file.endsWith('.js') || file.endsWith('.ts')))]
        const cwd = process.cwd()
        console.debug(`\ntryRCFiles`)
        console.group()
        console.log(`Path: ${cwd}`)
        const msg = `Files: ${rcFileNames.join(', ')}`
        console.log(msg)
        console.log(`-`.repeat(msg.length))

        for (const file of rcFileNames) {
            const filePath = path.join(cwd, file)
            console.group()
            console.debug(`try( ${file} )`)

            if (await fileExists(filePath)) {
                console.log(`Resolved: ${filePath}`)

                try {
                    const { default: config } = filePath.endsWith('.json')
                        ? await import(filePath, { with: { type: 'json' } })
                        : await import(filePath);
                    const fileName = filePath.split('/').pop() || ''
                    const prop = RC_FILE_NAMES_PROP[fileName as keyof typeof RC_FILE_NAMES_PROP]
                    const value = prop ? config[prop] : config
                    if (typeof value === 'object' && value !== null) {
                        console.log(`Loaded: ${filePath}`)
                        console.log(value)
                        console.log(`---`)
                        return { filePath, config: value }
                    }
                    if (prop)
                        console.log(`Config file does not contain '${prop}' property: ${filePath}`)
                    else
                        console.log(`Config file does not contain valid properties: ${filePath}`)
                } catch (error: any) {
                    console.warn(`Load Failed: ${filePath}`)
                    console.error(error.name + ':', error.message)
                }
            } else {
                console.info(`Not found: ${filePath}`)
            }
            console.groupEnd()
        }

        throw new TypeError(`No valid config found at path: ${cwd}`)

    } catch (error) {
        throw error
    }
}

// export async function resolveRC(file?: string): Promise<string> {
//     if (!file) {
//         const cwd = process.cwd()

//         const denoConfigFile = path.join(cwd, 'deno.json');
//         const rpcConfigFile = path.join(cwd, 'rpc.json');

//         if (await fileExists(rpcConfigFile))
//             return resolveRC(rpcConfigFile);

//         if (await fileExists(denoConfigFile))
//             return resolveRC(denoConfigFile);

//         throw new TypeError(`Missing config file at path: ${cwd}, deno.json or rpc.json required`);
//     }

//     return file
// }

type ParseRCInput = Record<string, string>;

// Overloads
export function parseRC(input: ParseRCInput, group: true): ConfigInitMap;
export function parseRC(input: ParseRCInput, group?: false): ConfigInit[];

// Implementation
export function parseRC(input: ParseRCInput, group: boolean = false): any {
    const inits: ConfigInit[] = mapToSet(input)
        .map(server => ({ server }));

    return group === true
        ? groupByDeep(inits, "server.$id")
        : inits;
}

export async function loadRC(fileNames?: string[], debug?: ConsoleLevel): Promise<ConfigInit[]> {
    const { config } = await tryRCFiles(RC_FILE_NAMES.concat(fileNames ? fileNames : []), debug);

    return mapToSet(config)
        .map(server => ({ server }))
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
        get runtime() {
            return navigator.userAgent
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
                BASE_URL: String(new URL(this.server.base, String(url))),
                ENDPOINT: this.server.endpoint,
                RUNTIME: this.runtime,
                RPC_DIR: this.rpcDir,
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