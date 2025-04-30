// deno-lint-ignore-file no-process-global
import { mkdir } from "node:fs/promises";
import { fileExists, formatBase, getDenoConfig, getInspectorUrl, groupByDeep, mapToSet, resolvePath } from "../utils/mod.ts";
import type { ConfigInit, Config, ConfigInitMap } from "../types/config.ts";
import path, { join, resolve } from "node:path";
import { extendConsole } from "../utils/console.ts";

const console = extendConsole('config')

export const RPC_DIR = process.env.RPC_DIR || process.env.HOME + '/.rpc'
export const RPC_GEN_DIR = RPC_DIR + '/gen'
export const RPC_LIB_DIR = RPC_GEN_DIR + '/lib'
export const RPC_PRO_DIR = RPC_GEN_DIR + '/pro'

export const RC_FILE_NAMES = [
    'deno.json',
    'rpc.json',
    '.rpcrc',
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

const isFile = (arg: string) => arg.endsWith('.json') || arg.endsWith('.js') || arg.endsWith('.ts')

export async function loadRC(fileNames?: string | string[]): Promise<ConfigInit[]> {
    // if (!Array.isArray(fileNames))
    //     fileNames = fileNames ? [fileNames] : []
    let res: {
        $file: string;
        config: Record<string, string>;
    }

    if (typeof fileNames === 'string') {
        if (isFile(fileNames)) {
            res = await resolveRC([fileNames], process.cwd())
        } else {
            res = await resolveRC(RC_FILE_NAMES, path.resolve(fileNames))
        }
    } else if (Array.isArray(fileNames)) {
        res = await resolveRC(fileNames, process.cwd())
    } else {
        res = await resolveRC(RC_FILE_NAMES, process.cwd())
    }

    const { config, $file } = res

    return mapToSet(config, $file)
        .map(server => {
            const $id = [server.$id, server.base].join('')
            const $uid = [$id, server.path].join(',')

            return {
                $id,
                $uid,
                $file,
                server: {
                    ...server,
                    $file
                }
            }
        })
}

export async function resolveRC(rcFileNames: string | string[], cwd: string): Promise<{ $file: string, config: Record<string, string> }> {
    try {

        if (!Array.isArray(rcFileNames)) {
            rcFileNames = [rcFileNames]
        }
        rcFileNames = [...new Set(rcFileNames.filter((file: string) => file.endsWith('.json') || file.endsWith('.js') || file.endsWith('.ts')))]

        // console.debug(`resolveRC(${rcFileNames})`)
        // console.group()
        // console.debug(`Path:`, cwd)
        // console.debug(`Files:`, rcFileNames)

        for (const file of rcFileNames) {
            const $file = path.resolve(cwd, file)
            const $path = path.dirname($file)
            console.debug(`try( ${file} )`)
            console.group()

            if (await fileExists($file)) {
                console.debug(`Resolved: ${$file}`)

                try {
                    const { default: config } = $file.endsWith('.json')
                        ? await import($file + `?v=${Date.now()}`, { with: { type: 'json' } })
                        : await import($file + `?v=${Date.now()}`);
                    const fileName = $file.split('/').pop() || ''
                    const prop = RC_FILE_NAMES_PROP[fileName as keyof typeof RC_FILE_NAMES_PROP]
                    const value = prop ? config[prop] : config
                    if (typeof value === 'object' && value !== null) {
                        console.debug(`Loaded: ${$file}`, value)
                        console.groupEnd()
                        Object.keys(value).forEach(key => {
                            value[key] = resolve($path, value[key])
                        })
                        return { $file, config: value }
                    }
                    if (prop)
                        console.debug(`Config file does not contain '${prop}' property: ${$file}`)
                    else
                        console.debug(`Config file does not contain valid properties: ${$file}`)
                } catch (error: any) {
                    console.warn(`Load Failed: ${$file}`)
                    console.error(error.name + ':', error.message)
                }
            } else {
                console.debug(`Not found: ${$file}`)
            }
            console.groupEnd()
        }

        // console.groupEnd()

        throw new TypeError(`No valid config found at path: ${cwd}`)
    } catch (error) {
        throw error
    }
}


type ParseRCInput = Record<string, string>;

// Overloads
export function parseRC(input: ParseRCInput, group: true): ConfigInitMap;
export function parseRC(input: ParseRCInput, group?: false): ConfigInit[];

// Implementation
export function parseRC(input: ParseRCInput, group: boolean = false): any {
    const inits: ConfigInit[] = mapToSet(input)
        .map(server => {
            const $id = [server.$id, server.base].join('')
            const $uid = [$id, server.path].join(',')
            const $file = undefined
            server.path = resolve(server.path)
            return {
                $id,
                $uid,
                $file,
                server: {
                    ...server,
                    $file
                }
            }
        });

    return group === true
        ? groupByDeep(inits, "server.$id")
        : inits;
}

export function defineConfig(init: ConfigInit): Config {
    init = { ...init }
    const server = init.server = init.server || {}

    server.path = server.path ? (server.path) : process.cwd()
    server.port = Number(server.port || 0)
    server.base = formatBase(server.base)

    const client = init.client = init.client || {}

    client.base = formatBase(server.base + (client.base || '@client'))

    const denoConfig = getDenoConfig(server.path)

    const shared = init.shared = init.shared || {}

    shared.jsxImportUrl = shared.jsxImportUrl || denoConfig.compilerOptions?.jsxImportSource

    const config: Config = {
        get $id() {
            return init.$id
        },
        get $uid() {
            return init.$uid
        },
        get $file() {
            return init.$file
        },
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
        async inspector(dev?: boolean) {
            return {
                scheme: (dev
                    ? config.protocol + 'dev'
                    : config.protocol
                ) + '://',
                url: (dev
                    ? await getInspectorUrl()
                    : `https://rpc.debuno.dev`
                ) + '#'
            }
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