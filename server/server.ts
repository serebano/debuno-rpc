import process from "node:process";
import type { ConfigInit } from "../types/config.ts";
import type { ServerAddr } from "../types/server.ts";
import { serve, type Server } from "../../debuno-serve/mod.ts";
import type { Route } from "../types/router.ts";
import { createRouter } from "../utils/router.ts";
import { groupByDeep } from "../utils/mod.ts";
import defaultRouter from "./defaultRouter.ts";
import { createApp } from "./app.ts";

export async function create2(...inits: ConfigInit[]) {
    const grouped = groupByDeep(inits, 'server.port')
    const ports = Object.keys(grouped).map(Number)

    return await Promise.all(ports.map(port => create(port, grouped[port])))

}


export async function create(port: number, init: ConfigInit[]) {
    const apps = init.map(createApp)

    const appsRoute = apps.map(app => {
        return {
            match: (_req, url) => url.pathname.startsWith(app.config.server.base),
            fetch: app.router.fetch
        } as Route
    })

    appsRoute.push({
        match: () => true,
        fetch: defaultRouter().fetch,
    })

    const { match, fetch } = createRouter(appsRoute)

    const controller = new AbortController()
    const { signal } = controller
    const abort = (reason?: any) => controller.abort(reason)

    const result = { server: {} as Server, addr: {} as ServerAddr, match, fetch, abort, signal, apps }

    const onListen = async (addr: ServerAddr) => {
        result.addr = addr
        for (const app of apps) {
            await app.onStart(addr)
        }
    }

    const onAbort = async (reason?: any) => {
        for (const app of apps) {
            await app.onStop(reason)
        }
    }

    result.server = await serve({ fetch, port, signal, onListen });

    process.on('SIGINT', async () => {
        console.log()
        console.group("[server] shutting down...")
        console.log()
        try {
            await onAbort()
            controller.abort(); // Gracefully shut down server
            console.groupEnd()
            console.log()
            console.log(`[server] stopped`)
        } catch (e: any) {
            console.groupEnd()
            console.log()
            console.log(`[server] ${e.message}`)
        } finally {
            process.exit(0)
        }
    })

    return result
}

// export async function createServer(init: ConfigInit): Promise<Server> {
//     const { fetch, config, onStop: onAbort, onStart: onListen } = createApp(init)
//     const { port } = config.server

//     const controller = new AbortController()
//     const { signal } = controller

//     const server = await serve({ fetch, port, signal, onListen });

//     process.on('SIGINT', async () => {
//         console.log()
//         console.group("[server] shutting down...")
//         console.log()
//         try {
//             await onAbort()
//             controller.abort(); // Gracefully shut down server
//             console.groupEnd()
//             console.log()
//             console.log(`[server] stopped`)
//         } catch (e: any) {
//             console.groupEnd()
//             console.log()
//             console.log(`[server] ${e.message}`)
//         } finally {
//             process.exit(0)
//         }
//     })

//     return server
// }