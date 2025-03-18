import type { Config } from "../types/config.ts";
import type { Route, Router } from "../types/router.ts";
import { cyan, gray } from "./colors.ts";

export function createRoute<F extends (init: Config) => Route>(factory: F): F {
    return factory;
}

export function route(match: Route['match'], fetch: Route['fetch']): Route {
    return { match, fetch }
}

export function router(routes: Route[]): Router {

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

        return new Response(
            `400 - Bad Request\n[${request.method}] ${url.pathname}`,
            { status: 400 }
        )
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
            const response = await handle(request, url)
            console.groupEnd()
            console.log(cyan(' ⮑'), response.status, ...[response.statusText, response.headers.get('location'), response.headers.get('Content-Type')].filter(Boolean));

            try {
                response.headers.set('Server', 'debuno/rpc')
                response.headers.set('Access-Control-Allow-Origin', '*')
                response.headers.set('Access-Control-Allow-Headers', '*')
                response.headers.set('Access-Control-Allow-Methods', '*')
                response.headers.set('Access-Control-Expose-Headers', '*')
            } catch { /** */ }


            return response
        }
    }
}

