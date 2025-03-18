// deno-lint-ignore-file no-process-global
import { mkdir, rm } from "node:fs/promises";
import { formatBase, getDenoConfig, resolvePath } from "./utils/mod.ts";
import type { ConfigInit, Config } from "./types/config.ts";
import { resolve } from "node:path";

export const RPC_DIR = process.env.RPC_DIR || process.env.HOME + '/.rpc'
export const RPC_GEN_DIR = RPC_DIR + '/gen'
export const RPC_LIB_DIR = RPC_GEN_DIR + '/lib'
export const RPC_PRO_DIR = RPC_GEN_DIR + '/pro'

await rm(RPC_DIR, { recursive: true, force: true })
await mkdir(RPC_DIR, { recursive: true });

export function defineConfig(init: ConfigInit = {}): Config {
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
            return {
                path: server.path!,
                port: server.port!,
                base: server.base!
            }
        },
        get client() {
            return {
                base: client.base!,
                path: this.dev
                    ? resolvePath('./client', import.meta.url)
                    : resolvePath('./dist/client', import.meta.url)
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

    console.log(`path = ${config.server.path}`)
    console.log(`port = ${config.server.port}`)
    console.log(`base = ${config.server.base}`)
    console.log(`dev = ${config.dev}`)

    return config
}