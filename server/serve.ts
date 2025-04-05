import type { App } from "../types/app.ts";
import { createConsole, type ConsoleLevel } from "../utils/console.ts";
import { groupByDeep } from "../utils/mod.ts";
import { createRouter } from "../utils/router.ts";
import { createApp } from "./app.ts";
import { loadRC, parseRC, type ConfigInit, type ServerAddr } from "./index.ts";
import * as debunoServe from "/Users/serebano/dev/debuno-serve/mod.ts";

export type RPCServerState = 'idle' | 'starting' | 'listening' | 'closed' | 'errored'
export interface RPCServer {
    $id: string;
    state: RPCServerState;
    config: ConfigInit['server']
    /** debuno-serve server instance */
    server?: debunoServe.Server;
    error?: Error | string;

    addr?: ServerAddr;
    apps: App[];
}

export interface RPCServeOptions {
    consoleLevels?: ConsoleLevel[]
    throwIfError?: boolean;
    onInit?: (server: RPCServer) => void;
    onStateChange?: (server: RPCServer) => void;
    onStarting?: (server: RPCServer) => void;
    onListening?: (server: RPCServer) => void;
    onClosed?: (server: RPCServer) => void;
    onErrored?: (server: RPCServer) => void;
}

export async function serve(): Promise<RPCServer[]>
export async function serve(rcFilePath?: string, options?: RPCServeOptions): Promise<RPCServer[]>

export async function serve(map: Record<string | number, string>, options?: RPCServeOptions): Promise<RPCServer[]>

export async function serve(init: ConfigInit[], options?: RPCServeOptions): Promise<RPCServer[]>

export async function serve(
    input?: ConfigInit[] | Record<string | number, string> | undefined | string,
    options?: RPCServeOptions
): Promise<RPCServer[]> {

    if (!input || typeof input === 'string')
        input = await loadRC(input)

    if (!Array.isArray(input)) {
        input = parseRC(input)
    }

    if (!input.length) {
        throw new Error('No configs provided')
    }

    options = options || {}

    const grouped = groupByDeep(input, 'server.$id')
    const servers: RPCServer[] = []
    for (const $id in grouped) {
        const config = grouped[$id].at(0)?.server!
        let serverState: RPCServerState = 'idle'

        const server = {
            $id,
            apps: [],
            config,
            get state() {
                return serverState
            },
            set state(state: RPCServerState) {
                serverState = state

                console.log(state)


                if (options?.onStateChange) {
                    options.onStateChange(server)
                }

                if (state === 'starting' && options?.onStarting) {
                    options.onStarting(server)
                }
                if (state === 'listening' && options?.onListening) {
                    options.onListening(server)
                }
                if (state === 'closed' && options?.onClosed) {
                    options.onClosed(server)
                }
                if (state === 'errored' && options?.onErrored) {
                    options.onErrored(server)
                }

            },
            _state: 'idle' as RPCServerState
        } as RPCServer

        if (options?.onInit) {
            options.onInit(server)
        }

        const console = createConsole(`[server][${$id}]`, {
            levels: options?.consoleLevels,
        })

        const inits = grouped[$id]

        const apps = inits.map(init => createApp(init, {
            consoleLevels: options?.consoleLevels,
        }))
        server.apps = apps
        const router = createRouter(apps.map(app => ({
            fetch: app.router.fetch,
            match(_, url) {
                return url.pathname.startsWith(app.config.server.base)
            }
        })))

        const onListen = async (addr: ServerAddr) => {
            server.addr = addr
            server.error = undefined
            server.state = 'listening'

            for (const app of apps) {
                await app.onStart(addr)
            }
        }

        const onClose = async (error?: any) => {
            server.error = error
            server.addr = undefined
            server.apps = []
            server.server = undefined
            server.state = 'closed'

            for (const app of apps) {
                await app.onStop(error)
            }
        }

        const onError = async (error: any) => {
            server.error = error
            server.state = 'errored'

            for (const app of apps) {
                app.onError(error)
            }

            await onClose(error)

            if (options?.throwIfError) {
                throw error
            }
        }

        try {
            server.state = 'starting'

            server.server = await debunoServe.serve({
                port: config.port,
                hostname: config.hostname,
                fetch: router.fetch,
                onListen,
                onClose,
                onError
            })
        } catch (e: any) {
            await onError(e)
        }

        servers.push(server)
    }
    return servers
}
