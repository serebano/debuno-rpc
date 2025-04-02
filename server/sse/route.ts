import { getFiles } from "./files.ts";
import { readEndpoints } from "./endpoints.ts";
import type { SSE, SSETarget } from "./types.ts";
import { createRoute } from "../../utils/router.ts";
import type { Config } from "../../types/config.ts";

export const emitEndpoints = (target: SSE | SSETarget, data: any) => target.emit('endpoints', data)
export const emitFiles = (target: SSE | SSETarget, data: any) => target.emit('files', data)

export default createRoute((config, context) => {
    return {
        match(request, url) {
            return request.method === 'GET' && url.pathname === config.server.base && !!request.headers.get('accept')?.includes('text/event-stream')
        },
        async fetch(_, url) {
            const target = context.sse.createTarget()

            await getAndEmitEndpoints(target)
            await getAndEmitFiles(target, url.origin, config)

            return target.asResponse()
        }
    }

})

async function getAndEmitFiles(sse: SSE | SSETarget, origin: string, cfg: Config) {
    emitFiles(sse, await getFiles({
        path: cfg.server.path,
        base: cfg.server.base,
        filter: cfg.filter,
        origin,
    }))
}

async function getAndEmitEndpoints(target: SSE | SSETarget) {
    emitEndpoints(target, await readEndpoints())
}


