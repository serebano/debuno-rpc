import { readFile } from "node:fs/promises";
import { getGenCode } from "./transform.ts";
import { resolve } from "node:path";

export interface LibHandlerInit {
    base?: string
}

export function createLibHandler(path: string, init: LibHandlerInit = {}): {
    path: string;
    base: string;
    handler: (request: Request) => Promise<Response>;
} {
    path = resolve(path)
    const base = init.base || '/@lib'

    async function handler(request: Request) {
        const url = new URL(request.url)

        url.pathname = url.pathname.replace(base, '/').replace('//', '/')

        const exts = ['ts', 'tsx', 'js', 'jsx', 'json']
        const hasExt = !url.pathname.endsWith('/') && !!exts.find(ext => url.pathname.endsWith(ext)) // url.pathname.split('.').pop()

        if (!hasExt)
            url.pathname = `${url.pathname}.ts`

        const userAgent = request.headers.get('user-agent')
        const isBrowser = userAgent?.includes('Chrome') || userAgent?.includes('Firefox') || userAgent?.includes('Safari');

        const absFilePath = path + url.pathname

        const body = isBrowser
            ? await getGenCode(absFilePath)
            : await readFile(absFilePath)


        return new Response(body, {
            status: 200,
            headers: {
                'Content-Type': isBrowser
                    ? `application/javascript`
                    : `application/typescript`
            }
        });


    }

    return {
        path,
        base,
        handler
    }
}