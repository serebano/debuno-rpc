import type { RPCApp } from "../types/app.ts";
import type { Hooks, Route, Router } from "../types/router.ts";
import { cyan, gray, green, red } from "./colors.ts";
import { extendConsole } from "./console.ts";

const console = extendConsole('router', { showNS: false })

export function createRoute<F extends (app: RPCApp) => Route>(factory: F): F {
    return factory;
}

export function route(match: Route['match'], fetch: Route['fetch'], name?: string): Route {
    return { match, fetch, name }
}

export function createRouter(routes: Route[], hooks?: Hooks): Router {

    async function match(request: Request, url: URL) {
        return await Promise.all(routes.filter(route => route.match(request, url)))
    }

    async function handle(request: Request, url: URL): Promise<Response> {
        const routes = await match(request, url)

        for (const route of routes) {

            // console.debug()
            console.debug(`>`, cyan(`[${request.method}]`), gray(`[${route.name}]`), url.pathname + url.search, gray(request.headers.get('accept')?.split(',').shift()!), gray(request.headers.get('user-agent')?.split(' ').shift()!))
            console.group()

            try {
                const response = await route.fetch(request, url)

                console.groupEnd()
                console.debug(`<`, green(`[${request.method}]`), gray(`[${route.name}]`), response?.status, ...[response?.statusText, response?.headers.get('location'), response?.headers.get('Content-Type')].filter(Boolean));

                if (response) {
                    return response
                }
            } catch (e: any) {
                console.groupEnd()
                console.debug(`<`, red(`[${request.method}]`), gray(`[${route.name}]`), red(e.message));

                throw e
            }
        }

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
            })
        }

        if (request.method === 'HEAD') {
            return new Response(null, { status: 200 })
        }

        return new Response(JSON.stringify({
            error: {
                status: 400,
                message: `Bad Request`
            }
        }, null, 4), { status: 200 })
    }

    function request(input: Request | URL | string, init?: RequestInit): Promise<Response> | Response {
        const request = input instanceof Request ? input : new Request(input, init)

        return router.fetch(request)
    }

    const router: Router = {
        routes,
        hooks,
        match(request) {
            return match(request, new URL(request.url))
        },
        async fetch(request) {
            const url = new URL(request.url)
            // console.debug()
            // console.debug(cyan(`[${request.method}]`), url.pathname + url.search, gray(request.headers.get('accept')?.split(',').shift()), gray(request.headers.get('user-agent')?.split(' ').shift()))
            // console.group()

            try {
                const response = await handle(request, url)

                if (hooks?.onResponse)
                    return await hooks.onResponse(request, response)

                return response
            } catch (error: any) {
                console.groupEnd()

                const errres = {
                    error: {
                        message: error.message as string,
                        stack: error.stack.split('\n')
                            .filter((line: string) => line.trim().startsWith('at '))
                            .map((line: string) => line.trim().split('at ').pop()) as string[],
                        code: error.code,
                        path: error.path
                    },
                    status: error.code === 'ENOENT' ? 404 : 500
                }

                const response = hooks?.onError
                    ? await hooks.onError(request, errres)
                    : Response.json(errres, {
                        status: errres.status
                    })

                if (hooks?.onResponse)
                    return await hooks.onResponse(request, response)

                return response
            }
        },
        request
    }

    return router
}

