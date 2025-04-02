import type { Config } from "../types/config.ts";
import type { Context } from "../types/context.ts";
import type { Hooks, Route, Router } from "../types/router.ts";
import { cyan, gray } from "./colors.ts";

export function createRoute<F extends (config: Config, context: Context) => Route>(factory: F): F {
    return factory;
}

export function route(match: Route['match'], fetch: Route['fetch']): Route {
    return { match, fetch }
}

export function createRouter(routes: Route[], hooks?: Hooks): Router {

    async function match(request: Request, url: URL) {
        return await Promise.all(routes.filter(route => route.match(request, url)))
    }

    async function handle(request: Request, url: URL): Promise<Response> {
        const routes = await match(request, url)

        for (const route of routes) {
            const response = await route.fetch(request, url)
            if (response)
                return response
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

    return {
        match(request) {
            return match(request, new URL(request.url))
        },
        async fetch(request) {
            const url = new URL(request.url)
            console.log()
            console.log(cyan(`[${request.method}]`), url.pathname + url.search, gray(request.headers.get('accept')?.split(',').shift()), gray(request.headers.get('user-agent')?.split(' ').shift()))
            console.group()

            try {
                const response = await handle(request, url)

                console.groupEnd()
                console.log(cyan(' ⮑'), response.status, ...[response.statusText, response.headers.get('location'), response.headers.get('Content-Type')].filter(Boolean));

                if (hooks?.onResponse)
                    return await hooks.onResponse(request, response)


                return response
            } catch (error: any) {
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
        }
    }
}

