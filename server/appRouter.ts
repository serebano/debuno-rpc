import type { Router } from "../types/router.ts";
import { moduleVersionTransform, open } from "../utils/mod.ts";
import { createRouter, route } from "../utils/router.ts";
import libRoute from "./lib/route.ts";
import meta from "./meta/mod.ts";
import rpcRoute from './rpc/route.ts'
import { getFiles } from "./sse/files.ts";
import { getEndpoints, readEndpoints } from "./sse/endpoints.ts";
import sseRoute from './sse/route.ts'
import type { App } from "../types/app.ts";
import { readFile } from "node:fs/promises";

export function createAppRouter(app: App): Router {
    const appId = [app.config.server.$id, app.config.server.base].join(':')

    return createRouter([
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
            }),
            appId
        ),
        /** [HEAD] */
        route(
            (req, _url) => req.method === 'HEAD',
            (_req, _url) => new Response(null, {
                headers: {
                    'x-path': app.config.server.path,
                    'x-base': app.config.server.base,
                    'x-port': app.config.server.port,
                    'x-host': app.config.server.host,
                    'x-hostname': app.config.server.hostname,
                    'x-protocol': app.config.server.protocol,
                    'x-endpoint': app.config.server.endpoint
                } as any
            }),
            appId
        ),
        /** favicon.ico */
        route(
            (req, url) => req.method === 'GET' && url.pathname === '/favicon.ico',
            () => new Response(null, { status: 204 }),
            appId
        ),
        /** ?base - Redirects to base url */
        route(
            (req, url) => url.searchParams.has('base'),
            (_req, url) => Response.redirect(`${url.origin}${app.config.server.base}`),
            appId
        ),
        /** 
         * Opens url in rpc.dash app 
         * @query ?dash
         * @query ?dash=dev - append dev to protocol (ex: web+rpcdev://) 
         */
        route(
            (req, url) => url.searchParams.has('dash'),
            async (_req, url) => {
                const protocol = app.config.protocol + url.searchParams.get('dash')
                url.searchParams.delete('dash')
                const protoUrl = `${protocol}://${url.host}${url.pathname}${url.searchParams.size ? `?${url.searchParams}` : ``}`
                console.debug(`[dash] ${protoUrl}`)
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
            },
            appId
        ),
        /** 
         * Redirect to base url for event source request
         * @query ?event
         * @header accept: 'text/event-stream'
         * @redirect endpoint 
         */
        route(
            (req, url) => url.pathname !== app.config.server.base && (url.searchParams.has('event') || req.headers.get('accept') === 'text/event-stream'),
            (_req, url) => {
                return Response.redirect(`${url.origin}${app.config.server.base}${url.search}`)
            },
            appId
        ),
        /** ?files - Returns files */
        route(
            (req, url) => url.searchParams.has('files'),
            async (_req, url) => new Response(JSON.stringify(await getFiles({
                path: app.config.server.path,
                base: app.config.server.base,
                filter: app.config.filter,
                origin: url.origin,
                endpoint: app.config.server.endpoint
            }), null, 4), {
                headers: {
                    'content-type': 'application/json'
                }
            }),
            appId
        ),
        /** ?endpoints[=check] - Returns endpoints ( =check - Check status ) */
        route(
            (req, url) => url.searchParams.has('endpoints'),
            async (_req, url) => new Response(JSON.stringify(await getEndpoints(url.searchParams.get('endpoints') === 'check'), null, 4), {
                headers: {
                    'content-type': 'application/json'
                }
            }),
            appId
        ),
        /** ?meta */
        route(
            (req, url) => url.searchParams.has('meta'),
            async (req, url) => new Response(JSON.stringify(url.pathname !== app.config.server.base
                ? {
                    endpoint: app.config.server.endpoint,
                    base: app.config.server.base,
                    http: url.origin + url.pathname,
                    file: app.config.server.path + url.pathname.replace(app.config.server.base, '/'),
                    source: moduleVersionTransform(
                        await readFile(app.config.server.path + url.pathname.replace(app.config.server.base, '/'), 'utf-8'),
                        app.config.server.path + url.pathname.replace(app.config.server.base, '/'),
                        url.origin + url.pathname
                    ),
                    ...meta.get(url.origin + url.pathname)
                }
                : meta.get(), null, 4), {
                headers: {
                    'content-type': 'application/json'
                }
            }),
            appId
        ),
        /** ?server */
        route(
            (req, url) => url.searchParams.has('server'),
            async (req, url) => {
                const cmd = url.searchParams.get('server')

                switch (cmd) {
                    case 'start': {
                        const prevState = app.context.server?.state
                        await app.context.server?.start()
                        return Response.json({
                            prevState,
                            state: app.context.server?.state
                        });

                    }
                    case 'stop': {
                        const prevState = app.context.server?.state
                        await app.context.server?.stop()
                        return Response.json({
                            prevState,
                            state: app.context.server?.state
                        });

                    }
                    case 'restart': {
                        const prevState = app.context.server?.state
                        await app.context.server?.restart()
                        return Response.json({
                            prevState,
                            state: app.context.server?.state
                        });

                    }
                    default: {
                        return Response.json({
                            $id: app.config.server?.$id,
                            $file: app.config.server?.$file,
                            state: app.context.server?.state,
                            config: app.config.server,
                            apps: app.context.server?.apps.map(app => ({
                                $id: app.config.$id,
                                state: app.state
                            }))
                        })
                    }
                }
            },
            appId
        ),
        /** ?app */
        route(
            (req, url) => url.searchParams.has('app'),
            async (req, url) => {
                const cmd = url.searchParams.get('app')

                switch (cmd) {
                    case 'start': {
                        const prevState = app.context.state
                        await app.context.start()
                        return Response.json({
                            prevState,
                            state: app.context.state
                        });

                    }
                    case 'stop': {
                        const prevState = app.context.state
                        await app.context.stop()
                        return Response.json({
                            prevState,
                            state: app.context.state
                        });

                    }
                    case 'restart': {
                        const prevState = app.context.state
                        await app.context.restart()
                        return Response.json({
                            prevState,
                            state: app.context.state
                        });
                    }
                    default: {
                        return Response.json({
                            $id: app.config.$id,
                            state: app.context.state,
                            config: app.config
                        })
                    }
                }
            },
            appId
        ),
        /** ?json */
        route(
            (req, url) => url.searchParams.has('json') || (url.pathname === app.config.server.base && req.headers.get('x-dest') === 'document'),
            async (req, url) => new Response(JSON.stringify({
                files: await getFiles({
                    path: app.config.server.path,
                    base: app.config.server.base,
                    filter: app.config.filter,
                    origin: url.origin,
                    endpoint: app.config.server.endpoint
                }),
                origins: await readEndpoints(),
                meta: meta
            }, null, 4), {
                headers: {
                    'content-type': 'application/json'
                }
            }),
            appId
        ),
        /** client.envImportUrl */
        route(
            (_req, url) => url.pathname === app.config.client.envImportUrl,
            (_req, url) => new Response(`export const create = (meta) => (${JSON.stringify(app.config.getEnv(url), null, 4)})`, {
                headers: {
                    'content-type': 'application/javascript'
                }
            }),
            appId
        ),
        { ...libRoute(app), name: appId },
        { ...sseRoute(app), name: appId },
        { ...rpcRoute(app), name: appId }
    ], {
        onError(request, error) {
            return new Response(JSON.stringify({
                ...error,
                url: request.url,
                env: app.context.env.version
            }, null, 2), { status: error.status })
        },
        onResponse(request, response) {
            try {
                const url = new URL(request.url)
                response.headers.set('Server', `${app.context.env.version}`)
                response.headers.set('X-RPC', app.context.env.version[0])
                response.headers.set('X-URL', url.href)
                response.headers.set('X-Runtime', app.context.env.version[1])
                response.headers.set('X-Base', app.config.server.base)
                response.headers.set('X-Base-Url', `${url.origin}${app.config.server.base}`)
                response.headers.set('X-Filename', url.href.replace(`${url.origin}${app.config.server.base}`, ''))

                response.headers.set('Access-Control-Allow-Origin', '*')
                response.headers.set('Access-Control-Allow-Headers', '*')
                response.headers.set('Access-Control-Allow-Methods', '*')
                response.headers.set('Access-Control-Expose-Headers', '*')
            } catch { /** */ }

            return response
        }
    })

}

