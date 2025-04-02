import { defineConfig } from './config.ts'
import { create2, createServer } from './server.ts'
import { start } from "./start.ts";

export function serve(...rpcmap: { path: string, port: number, base: string }[]) {
    return create2(...rpcmap.map(({ path, port, base }) => ({
        server: { path, port, base }
    })))

}

export {
    defineConfig,
    createServer
}

export const rpc = start
export default start