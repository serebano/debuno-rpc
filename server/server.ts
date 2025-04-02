import process from "node:process";
import router from "./router.ts";
import { watchFiles } from "./sse/files.ts";
import { addEndpoint, watchEndpointsConfig, removeEndpoint } from "./sse/endpoints.ts";
import { createSSE } from "./sse/create.ts";
import meta from "./meta/mod.ts";
import type { Config, ConfigInit } from "../types/config.ts";
import type { ServerAddr } from "../types/server.ts";
import { defineConfig } from "./config.ts";
import { serve, type Server } from "../../debuno-serve/mod.ts";
import type { Context } from "../types/context.ts";
import type { Route } from "../types/router.ts";
import { createRouter } from "../utils/router.ts";
import { groupByDeep } from "../utils/mod.ts";
import { createEnv } from "./env.ts";
import * as colors from "../utils/colors.ts";
import defaultRouter from "./defaultRouter.ts";


export function createApp(init: ConfigInit): {
    match(request: Request): Promise<Route[]>
    fetch(request: Request): Promise<Response> | Response
    onListen(addr: ServerAddr): Promise<void>
    onAbort(reason?: any): Promise<void>
    config: Config
    context: Context
} {

    const config: Config = defineConfig(init)
    const context: Context = {
        env: createEnv(),
        sse: createSSE({
            space: 2,
            keepAlive: true
        }),
        addr: {} as ServerAddr,
    };

    const {
        match,
        fetch
    } = router(config, context)

    return {
        match,
        fetch,
        config,
        context,
        async onListen(addr) {
            const { url } = context.addr = addr;

            await addEndpoint(config, url.origin);
            watchEndpointsConfig(context.sse);

            watchFiles({
                path: config.server.path,
                base: config.server.base,
                origin: url.origin,
                filter: config.filter,
                target: context.sse
            }, (target, event) => {
                if (event.type === 'changed') {
                    const url = event.http;

                    meta.incVersion(url);
                    Object.assign(event, meta.get(url));

                    if (url.endsWith('.html')) {
                        target.emit('reload', url);
                    } else {
                        target.emit('change', meta.getDependents(url, true));
                    }
                }

                target.emit('file', event);
            }
            );

            console.log()
            console.group(`${colors.gray('[')}${colors.cyan('rpc.serve')}${colors.gray(']')} ${colors.yellow('{ ')} ${colors.red('"' + config.server.port + config.server.base + '"')}${(': ')}${colors.gray('"' + config.server.path + '"')}${colors.gray(' }')}`)
            console.log([
                url.origin + config.server.base,
                url.origin + config.server.base + '?event',
                url.origin + config.server.base + '?json',
                url.origin + config.server.base + '?dash',
                url.origin + config.server.base + '?dash=dev'
            ]);
            console.groupEnd()
            console.log()
        },
        async onAbort() {
            const endpoints = await removeEndpoint(config, context.addr.url.origin, (e) => context.sse.emit('endpoint', e))

            context.sse.emit('endpoints', endpoints);
        }
    };
}

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
            fetch: app.fetch
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
            await app.onListen(addr)
        }
    }

    const onAbort = async (reason?: any) => {
        for (const app of apps) {
            await app.onAbort(reason)
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

export async function createServer(init: ConfigInit): Promise<Server> {
    const controller = new AbortController()
    const { fetch, config, onAbort, onListen } = createApp(init)

    const { port } = config.server
    const { signal } = controller

    const server = await serve({ fetch, port, signal, onListen });

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

    return server
}