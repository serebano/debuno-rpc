import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { hasSourceFileChanged, transformFile } from "./transform.ts";
import { getContentType } from '../../utils/mod.ts'
import { createRoute } from "../../utils/router.ts";
import { RPC_LIB_DIR } from "../config.ts";

export interface LibHandlerInit {
    base?: string,
    index?: string,
    genDir?: string
}

export default createRoute((config, _context) => {
    const index = 'index.ts'
    const genDir = RPC_LIB_DIR + '/' + basename(config.client.path)

    console.log(`libHandler(`, [config.client.path, genDir], `)`)

    return {
        match(request, url) {
            return request.method === 'GET' && url.pathname.startsWith(config.client.base)
        },
        async fetch(request) {
            const url = new URL(request.url)
            const urlPath = url.pathname

            url.pathname = url.pathname.replace(config.client.base, '/').replace('//', '/')
            if (index && url.pathname === '/')
                url.pathname = `/${index}`

            const exts = ['ts', 'tsx', 'js', 'jsx', 'json']
            const hasExt = !url.pathname.endsWith('/') && !!exts.find(ext => url.pathname.endsWith(ext)) // url.pathname.split('.').pop()
            url.pathname = hasExt ? url.pathname : `${url.pathname}.ts`

            const requireTransform = !!['ts', 'tsx'].find(ext => url.pathname.endsWith(`.${ext}`))

            const userAgent = request.headers.get('user-agent')
            const isBrowser = userAgent?.includes('Mozilla');
            const srcFilePath = config.client.path + url.pathname
            const genFilePath = genDir + url.pathname + '.js'
            const resFilePath = isBrowser && requireTransform ? genFilePath : srcFilePath

            const IMPORT_META_ENV = `import.meta.env = (await import('${config.client.envImportUrl}')).create(import.meta);\n`

            const source = isBrowser && requireTransform
                ? await hasSourceFileChanged(srcFilePath, genFilePath)
                    ? await transformFile(srcFilePath, genFilePath, urlPath)
                    : await readFile(genFilePath)
                : await readFile(srcFilePath)

            const body = source.includes('import.meta.env')
                ? IMPORT_META_ENV + source
                : source

            return new Response(body, {
                status: 200,
                headers: {
                    'x-file-path': resFilePath,
                    'Content-Type': getContentType(resFilePath)
                }
            });
        }
    }
})