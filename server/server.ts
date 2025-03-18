import router from "./router.ts";
import { watchFiles } from "./sse/files.ts";
import { addOrigin, watchOrigins, removeOrigin } from "./sse/origins.ts";
import { sse } from "./sse/sse.ts";
import * as meta from "./meta.ts";
import type { Config } from "../types/config.ts";
import type { ServerAddr } from "../types/server.ts";
import { serve, type Server } from "../../debuno-serve/mod.ts";
import process from "node:process";

export const create = (init: Config): {
    fetch(request: Request): Promise<Response> | Response;
    onListen(addr: ServerAddr): Promise<void>;
    onAbort(reason?: any): Promise<void>;
} => {
    let serverAddr: ServerAddr

    return {
        fetch: router(init).fetch,
        async onListen(addr) {
            const { url } = serverAddr = addr;

            sse.emit('listen', { ...serverAddr, url: String(url) })

            await addOrigin(init, url.origin);

            watchOrigins(sse);

            watchFiles({
                path: init.server.path,
                base: init.server.base,
                origin: url.origin,
                filter: init.filter,
                target: sse,
                listener: (target, event) => {
                    if (event.type === 'changed') {
                        const id = event.http;

                        meta.versions[id] = meta.versions[id] || 0;
                        meta.versions[id]++;

                        meta.timestamps[id] = event.timestamp;

                        for (const key of Object.keys(meta.dependents)) {
                            if (id in meta.dependents[key]) {
                                meta.dependents[key][id] = meta.versions[id];
                            }
                        }

                        for (const key of Object.keys(meta.dependencies)) {
                            if (id in meta.dependencies[key]) {
                                meta.dependencies[key][id] = meta.versions[id];
                            }
                        }

                        event.version = meta.versions[id];
                        event.dependents = meta.dependents[id];
                        event.dependencies = meta.dependencies[id];

                        if (id.endsWith('.html')) {
                            target.emit('reload', id);
                        } else {
                            target.emit('change', meta.getDependents(id, true));
                        }
                    }

                    target.emit('file', event);
                }
            })

            // execFile('open', [`${config.protocol}://${url.origin}`]);
            console.log();
            console.log(`serve(`, [
                init.server.path,
                url.origin + init.server.base,
                url.origin + init.server.base + '?dash',
                `${init.protocol}://${url.host}${init.server.base}`
            ], `)`);
            console.log();
        },

        async onAbort() {
            const { url } = serverAddr

            sse.emit('abort', { ...serverAddr, url: String(url) })
            sse.emit('origins', await removeOrigin(init, url.origin, (e) => sse.emit('origin', e)))
        }
    }
}

export default async function (init: Config): Promise<Server> {
    const controller = new AbortController()

    const { fetch, onAbort, onListen } = create(init)
    const { port } = init.server
    const { signal } = controller

    const server = await serve({
        fetch,
        port,
        signal,
        onListen
    });

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