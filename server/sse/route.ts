
import type { SSE, SSETarget } from "./types.ts";
import { createRoute } from "../../utils/router.ts";

export const emitEndpoints = (target: SSE | SSETarget, data: any) => target.emit('endpoints', data)
export const emitFiles = (target: SSE | SSETarget, data: any) => target.emit('files', data)

export default createRoute((app) => {
    return {
        match(request, url) {
            return request.method === 'GET' && url.pathname === app.config.server.base && (!!request.headers.get('accept')?.includes('text/event-stream') || url.searchParams.has('event'))
        },
        async fetch() {
            const target = await app.context.sse.createTarget()
            return target.asResponse()
        }
    }

})