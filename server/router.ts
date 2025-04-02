import type { Config } from '../types/config.ts'
import type { Context } from "../types/context.ts";
import type { Router } from "../types/router.ts";
import { open } from "../utils/mod.ts";
import { createRouter, route } from "../utils/router.ts";
import libRoute from "./lib/route.ts";
import meta from "./meta/mod.ts";
import rpcRoute from './rpc/route.ts'
import { getFiles } from "./sse/files.ts";
import { getEndpoints, readEndpoints } from "./sse/endpoints.ts";
import sseRoute from './sse/route.ts'

export default (config: Config, context: Context): Router => createRouter([
    /** [OPTIONS] */
    route(
        (req) => req.method === 'OPTIONS',
        () => new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': '*',
                'Access-Control-Expose-Headers': '*',
                'Access-Control-Allow-Private-Network': 'true',
            }
        })
    ),
    /** [HEAD] */
    route(
        (req, _url) => req.method === 'HEAD',
        (_req, url) => new Response(null, {
            headers: {
                'x-path': config.server.path,
                'x-port': config.server.port,
                'x-base': config.server.base,
                'x-endpoint': `${url.origin}${config.server.base}`
            } as any
        })
    ),
    /** favicon.ico */
    route(
        (req, url) => req.method === 'GET' && url.pathname === '/favicon.ico',
        () => new Response(null, { status: 204 })
    ),
    /** ?base - Redirects to base url */
    route(
        (req, url) => url.searchParams.has('base'),
        (_req, url) => Response.redirect(`${url.origin}${config.server.base}`)
    ),
    /** 
     * Opens url in rpc.dash app 
     * @query ?dash
     * @query ?dash=dev - append dev to protocol (ex: web+rpcdev://) 
     */
    route(
        (req, url) => url.searchParams.has('dash'),
        async (_req, url) => {
            const protocol = config.protocol + url.searchParams.get('dash')
            url.searchParams.delete('dash')
            const protoUrl = `${protocol}://${url.host}${url.pathname}${url.searchParams.size ? `?${url.searchParams}` : ``}`
            console.log(`[dash] ${protoUrl}`)
            // return Response.redirect(recdirectUrl)
            try {
                await open(protoUrl)
                return new Response(JSON.stringify({ protocol, url: protoUrl }, null, 2))
            } catch (e: any) {
                const msg = `No application knows how to open URL`
                if (e.message.includes(msg)) {
                    throw new TypeError(`${msg}: ${protoUrl}`, { cause: e })
                }
                throw e
            }
        }
    ),
    /** 
     * Redirect to base url for event source request
     * @query ?event
     * @header accept: 'text/event-stream'
     * @redirect endpoint 
     */
    route(
        (req, url) => url.pathname !== config.server.base && (url.searchParams.has('event') || req.headers.get('accept') === 'text/event-stream'),
        (_req, url) => Response.redirect(`${url.origin}${config.server.base}${url.search}`, 303)
    ),
    /** ?files - Returns files */
    route(
        (req, url) => url.searchParams.has('files'),
        async (_req, url) => new Response(JSON.stringify(await getFiles({
            path: config.server.path,
            base: config.server.base,
            filter: config.filter,
            origin: url.origin
        }), null, 4), {
            headers: {
                'content-type': 'application/json'
            }
        })
    ),
    /** ?endpoints[=check] - Returns endpoints ( =check - Check status ) */
    route(
        (req, url) => url.searchParams.has('endpoints'),
        async (_req, url) => new Response(JSON.stringify(await getEndpoints(url.searchParams.get('endpoints') === 'check'), null, 4), {
            headers: {
                'content-type': 'application/json'
            }
        })
    ),
    /** ?meta */
    route(
        (req, url) => url.searchParams.has('meta'),
        (req, url) => new Response(JSON.stringify(url.pathname !== config.server.base
            ? meta.get(url.origin + url.pathname)
            : meta.get(), null, 4), {
            headers: {
                'content-type': 'application/json'
            }
        })
    ),
    /** ?json */
    route(
        (req, url) => url.searchParams.has('json') || (url.pathname === config.server.base && req.headers.get('x-dest') === 'document'),
        async (req, url) => new Response(JSON.stringify({
            files: await getFiles({
                path: config.server.path,
                base: config.server.base,
                filter: config.filter,
                origin: url.origin
            }),
            origins: await readEndpoints(),
            meta: meta
        }, null, 4), {
            headers: {
                'content-type': 'application/json'
            }
        })
    ),
    /** client.envImportUrl */
    route(
        (_req, url) => url.pathname === config.client.envImportUrl,
        (_req, url) => new Response(`export const create = (meta) => (${JSON.stringify(config.getEnv(url), null, 4)})`, {
            headers: {
                'content-type': 'application/javascript'
            }
        })
    ),
    libRoute(config, context),
    sseRoute(config, context),
    rpcRoute(config, context)
], {
    onError(request, error) {
        return new Response(JSON.stringify({
            ...error,
            url: request.url,
            env: context.env.version
        }, null, 2), { status: error.status })
    },
    onResponse(request, response) {
        try {
            const url = new URL(request.url)
            response.headers.set('Server', `${context.env.version}`)
            response.headers.set('X-RPC', context.env.version[0])
            response.headers.set('X-Runtime', context.env.version[1])
            response.headers.set('X-Base', config.server.base)
            response.headers.set('X-Base-Url', `${url.origin}${config.server.base}`)
            response.headers.set('Access-Control-Allow-Origin', '*')
            response.headers.set('Access-Control-Allow-Headers', '*')
            response.headers.set('Access-Control-Allow-Methods', '*')
            response.headers.set('Access-Control-Expose-Headers', '*')
        } catch { /** */ }

        return response
    }
})

