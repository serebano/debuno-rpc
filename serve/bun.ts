/// <reference types="npm:bun-types@1.1.42" />
/// <reference path="../node_modules/bun-types/index.d.ts" />
import { createRequestHandler, type ServeOptions } from "../mod.ts";
import type { Server } from "bun"

export const ENV = "bun" as const

export function serve(options: ServeOptions): Server {
    const { port, path, hostname } = options

    const server = Bun.serve({
        port,
        hostname,
        fetch: createRequestHandler({ readFile, readDir, path }),
        error: (error) => {
            options.onError?.(error)
            return Response.json({ error: error.message }, { status: 500 })
        }
    })

    options.onListen?.({
        port: server.port,
        hostname: server.hostname
    })

    return server
}

export function readFile(filePath: string): Promise<BodyInit> | BodyInit {
    return Bun.file(filePath.replace('file://', '')).bytes()
}

export function writeFile(filePath: string, data: any): Promise<number> {
    return Bun.write(filePath.replace('file://', ''), data)
}

export async function readDir(dirPath: string): Promise<string[]> {
    return Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: dirPath.replace('file://', '') }))
}