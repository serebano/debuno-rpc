import type { Config } from '../types/config.ts'
import type { Router } from "../types/router.ts";
import { router, route } from "../utils/router.ts";
import libRoute from "./lib/route.ts";
import rpcRoute from './rpc/route.ts'
import sseRoute from './sse/route.ts'

export default (config: Config): Router => router([
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
    route(
        (req, url) => req.method === 'GET' && url.pathname === '/favicon.ico',
        () => new Response(null, { status: 204 })
    ),
    route(
        (req, url) => url.pathname !== config.server.base && (url.searchParams.has('event') || req.headers.get('accept') === 'text/event-stream'),
        (req, url) => Response.redirect(`${url.origin}${config.server.base}${url.search}`, 303)
    ),
    route(
        (req, url) => req.method === 'HEAD',
        (req, url) => new Response(null, {
            headers: {
                'x-base': config.server.base,
                'x-base-url': `${url.origin}${config.server.base}`
            }
        })
    ),
    route(
        (req, url) => url.pathname === config.client.envImportUrl,
        (req, url) => new Response(`export const create = (meta) => (${JSON.stringify(config.getEnv(url), null, 4)})`, {
            headers: {
                'content-type': 'application/javascript'
            }
        })
    ),
    libRoute(config),
    sseRoute(config),
    rpcRoute(config)
])