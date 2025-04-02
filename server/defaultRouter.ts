import type { Router } from "../types/router.ts";
import { createRouter, route } from "../utils/router.ts";

export default (): Router => createRouter([
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
        (_req, url) => new Response(null)

    ),
    /** catch-all route */
    route(
        (req, url) => true,
        (req, url) => new Response(`Nui ${url}`, { status: 200 })
    ),

], {
    onError(request, error) {
        return new Response(JSON.stringify({
            ...error,
            url: request.url,
        }, null, 2), { status: error.status })
    },
    onResponse(request, response) {
        try {
            response.headers.set('Access-Control-Allow-Origin', '*')
            response.headers.set('Access-Control-Allow-Headers', '*')
            response.headers.set('Access-Control-Allow-Methods', '*')
            response.headers.set('Access-Control-Expose-Headers', '*')
        } catch { /** */ }

        return response
    }
})

