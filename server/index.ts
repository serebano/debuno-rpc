import { defineConfig } from './config.ts'
import { createServer } from './server.ts'

export function serve(path: string, port?: number, base?: string) {
    return createServer({
        server: {
            path,
            port,
            base
        }
    })
}

export {
    defineConfig,
    createServer
}