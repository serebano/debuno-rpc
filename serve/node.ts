import { createRequestHandler, type ServeOptions } from '../mod.ts'
import type { Server } from 'node:http'

export const ENV = "node" as const

export type NodeServeOptions = {
    hostname: string | undefined
    port: number,
    fetch: (request: Request) => Promise<Response> | Response,
    onListen?: (addr: { port: number, hostname: string }) => void,
    onError?: (error: Error) => void
}

const Node = {
    async serve(options: NodeServeOptions): Promise<Server> {
        const { createServer } = await import('node:http')
        const { createServerAdapter } = await import('@whatwg-node/server')

        const nodeRequestHandler = createServerAdapter(options.fetch)
        const server = createServer(nodeRequestHandler)

        server.on('error', (err) => options.onError?.(err))
        server.on('listening', () => {
            const { port, address: hostname } = server.address() as { port: number, address: string }

            options.onListen?.({ port, hostname })
        })

        return server.listen(options.port, options.hostname)
    }

}
export function serve(options: ServeOptions): Promise<Server> {
    const { port, path, hostname } = options

    return Node.serve({
        port,
        hostname,
        fetch: createRequestHandler({ readFile, readDir, path }),
        onListen: (addr) => {
            options.onListen?.(addr)
        },
        onError: (error) => {
            options.onError?.(error)
        }
    })
}

export async function readFile(filePath: string): Promise<ReadableStream> {
    try {
        const fs = await import('node:fs')
        const { Readable } = await import('node:stream')

        filePath = filePath.replace('file://', '')

        if (!fs.existsSync(filePath))
            throw new Error(`File not found: ${filePath}`)

        return Readable.toWeb(fs.createReadStream(filePath, {
            autoClose: true,
        })) as unknown as ReadableStream

    } catch (error: any) {
        throw error
    }
}

export async function writeFile(filePath: string, data: any): Promise<void> {
    const fs = await import('node:fs/promises')

    return fs.writeFile(filePath.replace('file://', ''), data)
}

export async function readDir(dirPath: string): Promise<string[]> {
    const fs = await import('node:fs/promises');
    dirPath = dirPath.replace('file://', '');
    const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true });

    return entries
        .filter(entry => entry.isFile())
        .map(entry => (entry.parentPath + '/' + entry.name).replace(dirPath.endsWith('/') ? dirPath : dirPath + '/', ''))
}