import { createRequestHandler, type ServeOptions } from "../mod.ts";

export const ENV = "deno" as const

export function serve(options: ServeOptions): Deno.HttpServer {
    const { port, path, hostname } = options

    return Deno.serve({
        port,
        hostname,
        handler: createRequestHandler({ readFile, readDir, path }),
        onListen: (addr) => options.onListen?.(addr),
        onError(error: any) {
            options.onError?.(error)
            return Response.json({ error: error.message }, { status: 500 })
        }
    })
}

export function symlink(target: string, path: string): Promise<void> {
    return Deno.symlink(target, path)
}

export function readFile(filePath: string): Promise<Uint8Array> {
    return Deno.readFile(filePath.replace('file://', ''))
}

export function writeFile(filePath: string, data: Uint8Array | string): Promise<void> {
    return Deno.writeFile(filePath.replace('file://', ''), typeof data === 'string' ? new TextEncoder().encode(data) : data)
}

export async function readDir(dirPath: string): Promise<string[]> {
    //@ts-ignore
    const { walk } = await import("jsr:@std/fs/walk")
    const dirs = await Array.fromAsync(walk(dirPath.replace('file://', '')));

    return dirs.filter((dir: any) => dir.isFile).map((file: any) => file.path.replace(dirPath.replace('file://', '') + '/', ''));
}