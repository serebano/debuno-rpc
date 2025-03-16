import config from "./config.ts";
import { moduleVersionTransform, moduleHtmlTransform } from "../utils/mod.ts";
import { createRpcHandler } from './rpc/handler.ts'
import { createLibHandler } from "./lib/handler.ts";
import { createSseHandler, onListen, onAbort } from './sse/handler.ts'

export { onListen, onAbort }

const rpc = createRpcHandler(config.path, {
    base: '/',
    protocol: config.protocol,
    srcKey: config.srcKey,
    outKey: config.genKey,
    read(code, file, http, req) {
        code = moduleVersionTransform(code, file, http)
        code = moduleHtmlTransform(code, file, http, req) as string

        return code
    }
});

const lib = createLibHandler(
    '/Users/serebano/dev/debuno-rpc/client',
    {
        base: '/@client'
    }
)

const sse = createSseHandler(config.path, {
    base: rpc.base,
    nextHandler: rpc.handler
})

export async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url)

    console.log(`[${request.method}]`, url.pathname)

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': '*',
                'Access-Control-Expose-Headers': '*',
                'Access-Control-Allow-Private-Network': 'true',
            }
        });
    }

    function handle(request: Request): Promise<Response> | Response {
        if (request.method === 'GET' && request.url.endsWith('/favicon.ico')) {
            return new Response(null, { status: 204 });
        }

        if (request.method === 'GET' && url.pathname.startsWith(lib.base))
            return lib.handler(request)

        if (['GET', 'POST'].includes(request.method) && url.pathname.startsWith(sse.base))
            return sse.handler(request)

        return new Response(`400 - Bad Request`, { status: 400 })
    }

    const response = await handle(request)

    try {
        response.headers.set('Access-Control-Allow-Origin', '*')
        response.headers.set('Access-Control-Allow-Headers', '*')
        response.headers.set('Access-Control-Allow-Methods', '*')
        response.headers.set('Access-Control-Expose-Headers', '*')
    } catch { /** */ }

    return response
}