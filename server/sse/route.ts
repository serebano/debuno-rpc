import { getFiles } from "./files.ts";
import { getOrigins } from "./origins.ts";
import * as meta from "../meta.ts";
import type { SSE, SSETarget } from "./types.ts";
import { createRoute } from "../../utils/router.ts";
import { sse } from "./sse.ts";
import type { Config } from "../../types/config.ts";

export default createRoute((init) => {
    const { path, base } = init.server
    const filter = init.filter

    return {
        match(request, url) {
            return request.method === 'GET' && url.pathname === base
        },
        async fetch(req, url) {

            const asJson = url.searchParams.has('json') || req.headers.get('x-dest') === 'document'
            const asEventStream = url.searchParams.has('event') || req.headers.get('accept') === 'text/event-stream'

            if (asJson) {
                return new Response(JSON.stringify({
                    files: await getFiles({ path, base, origin: url.origin, filter }),
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
                await getAndEmitFiles(target, url.origin, init)

                return target.asResponse()
            }
        }
    }

})

const emitOrigins = (target: SSE | SSETarget, data: any) => target.emit('origins', data)
const emitFiles = (target: SSE | SSETarget, data: any) => target.emit('files', data)


async function getAndEmitFiles(target: SSE | SSETarget, origin: string, init: Config) {
    const { filter } = init
    const { path, base } = init.server
    const files = await getFiles({ path, base, origin, filter })

    emitFiles(target, files)
}

async function getAndEmitOrigins(target: SSE | SSETarget) {
    const origins = await getOrigins()

    emitOrigins(target, origins)
}


