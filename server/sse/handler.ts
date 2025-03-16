import { createSSE } from "./createSSE.ts";
import { getFiles, watchFiles } from "./files.ts";
import { getOrigins, addOrigin, removeOrigin, watchOrigins } from "./origins.ts";
import config from "../config.ts";
import * as meta from "../meta.ts";
import type { SSE, SSETarget, FileEvent } from "./types.ts";
import { execFile } from "node:child_process";

export const sse = createSSE({
    space: 2,
    keepAlive: true
})

export interface SSEHandlerInit {
    base: string
    nextHandler: (req: Request) => Promise<Response>
}

export function createSseHandler(path: string, init: SSEHandlerInit) {

    const { nextHandler, base } = init

    async function handler(req: Request) {
        const url = new URL(req.url);
        if (url.pathname === '/') {
            const asJson = url.searchParams.has('json') || req.headers.get('x-dest') === 'document'
            const asEventStream = url.searchParams.has('event') || req.headers.get('accept') === 'text/event-stream'

            if (asJson) {
                return new Response(JSON.stringify({
                    files: await getFiles(path, url.origin),
                    origins: await getOrigins(),
                    versions: meta.versions,
                    dependents: meta.dependents,
                    dependencies: meta.dependencies
                }, null, 4), {
                    headers: {
                        'content-type': 'application/json',
                        'x-file-path': path
                    }
                })
            } else if (asEventStream) {
                const target = sse.createTarget()

                await getAndEmitOrigins(target)
                await getAndEmitFiles(target, url.origin)

                return target.asResponse()
            } else {
                return nextHandler(req)
            }
        } else {
            return nextHandler(req)
        }
    }

    return {
        path,
        base,
        handler
    }
}

const emitOrigins = (target: SSE | SSETarget, data: any) => target.emit('origins', data)
const emitFiles = (target: SSE | SSETarget, data: any) => target.emit('files', data)

const emitChange = (target: SSE | SSETarget, event: FileEvent) => {

    if (event.type === 'changed') {
        const id = event.http

        meta.versions[id] = meta.versions[id] || 0
        meta.versions[id]++

        meta.timestamps[id] = event.timestamp

        for (const key of Object.keys(meta.dependents)) {
            if (id in meta.dependents[key]) {
                meta.dependents[key][id] = meta.versions[id]
            }
        }

        for (const key of Object.keys(meta.dependencies)) {
            if (id in meta.dependencies[key]) {
                meta.dependencies[key][id] = meta.versions[id]
            }
        }

        event.version = meta.versions[id]
        event.dependents = meta.dependents[id]
        event.dependencies = meta.dependencies[id]

        if (id.endsWith('.html')) {
            target.emit('reload', id)
        } else {
            target.emit('change', meta.getDependents(id, true))
        }
    }

    target.emit('file', event)
}

async function getAndEmitFiles(target: SSE | SSETarget, origin: string) {
    const files = await getFiles(config.path, origin)

    emitFiles(target, files)
}

async function getAndEmitOrigins(target: SSE | SSETarget) {
    const origins = await getOrigins()

    emitOrigins(target, origins)
}


export async function onListen({ url }: { url: URL }) {
    await addOrigin(config.path, url.origin)
    watchOrigins(sse)
    watchFiles(config.path, url.origin, sse, emitChange)

    // execFile('open', [`${config.protocol}://${url.origin}`]);

    console.log()
    console.log(`serve(`, [
        config.path,
        url.origin,
        url.origin + '?dash',
        `${config.protocol}://${url.host}`
    ], `)`);
    console.log()
}

export async function onAbort({ url }: { url: URL }) {
    sse.emit('origins', await removeOrigin(config.path, url.origin, (e) => sse.emit('origin', e)))
}