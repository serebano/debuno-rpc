/// <reference types="npm:bun-types" />
/// <reference path="./node_modules/bun-types/index.d.ts" />
import { ENV, resolvePath, type ServeModule, type ServeOptions } from './mod.ts'
import type { Server as NodeServer } from 'node:http'
import process from "node:process";


if (!['node', 'deno', 'bun'].includes(ENV))
    throw new Error('Unknown environment')

type Servers = {
    node: NodeServer,
    deno: Deno.HttpServer,
    bun: ReturnType<typeof Bun.serve>
}

type Server = Servers[ENV]
type Serve = ServeModule<Server>

const serveModule: Serve = await import(`./serve/${ENV}.ts`)

export { ENV }
export const readDir: Serve['readDir'] = serveModule.readDir
export const readFile: Serve['readFile'] = serveModule.readFile
export const writeFile: Serve['writeFile'] = serveModule.writeFile

export async function serve(options: ServeOptions): Promise<Server> {

    const start = performance.now()
    options.path = resolvePath(options.path)

    const files = await serveModule.readDir(options.path)

    return serveModule.serve({
        ...options,
        onListen: async (addr: any) => {
            const took = performance.now() - start

            console.log(`(serve) listening`, {
                ENV,
                cwd: process.cwd(),
                url: `http://${addr.hostname}:${addr.port}`,
                path: (options.path),
                files,
                took: `${took}ms`
            })
            options.onListen?.(addr)
        },
        onError: (error: any) => {
            console.error(`(serve) error`, error)
            options.onError?.(error)
        }
    })
}