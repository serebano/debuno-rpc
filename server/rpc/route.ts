import { join, resolve } from "node:path";
import { exec } from "./exec.ts";
import { read } from "./read.ts";
import { editUsingExec, editUsingRedirect } from "./edit.ts";
import { hasSourceFileChanged, parseLocation, transformFile } from "./utils.ts";
import { homedir } from "node:os";
import { createRoute } from "../../utils/router.ts";
import { RPC_PRO_DIR } from "../../config.ts";
import { moduleHtmlTransform, moduleVersionTransform } from "../../utils/mod.ts";

export interface RpcHandlerInit {
    rpcImportUrl?: string
    hotImportUrl?: string
    envImportUrl?: string
    jsxImportUrl?: string;
    indexFileName?: string;
    protocol?: string;
    genDir?: string;
    srcKey?: string;
    outKey?: string;
    transform?: (sourceCode: string, filePath: string, url: string, req: Request) => string | Response | Promise<string | Response>
}

/**
 * Creates a handler function that processes incoming requests.
 *
 * @param init An object containing the source and output directories.
 * @returns A function that processes incoming requests.
 */

export default createRoute((config) => {
    const init: RpcHandlerInit = {
        jsxImportUrl: config.shared.jsxImportUrl,
        rpcImportUrl: config.client.rpcImportUrl,
        hotImportUrl: config.client.hotImportUrl,
        envImportUrl: config.client.envImportUrl,
        protocol: config.protocol,
        srcKey: config.srcKey,
        outKey: config.genKey
    }

    const { path, base } = config.server

    const srcDir = (path);
    const srcKey = init.srcKey || 'src' // basename(srcDir)
    const outKey = init.outKey || 'out' // basename(outDir)
    const indexFileName = init.indexFileName || 'index.html'

    init.transform = init.transform || function transform(code, file, http, req) {
        code = moduleVersionTransform(code, file, http)
        code = moduleHtmlTransform(code, file, http, req) as string

        return code
    }

    console.log(`rpcHandler(`, srcDir, `)`)

    return {
        match(request, url) {
            return ['GET', 'POST'].includes(request.method) && url.pathname.startsWith(base)
        },
        async fetch(request, url): Promise<Response> {
            const reqUrl = url.pathname.endsWith('/') ? url.href + indexFileName : url.href
            const loc = parseLocation(reqUrl)
            url = new URL(loc.url);

            const genDir = init.genDir ? resolve(init.genDir) : RPC_PRO_DIR + ('/' + [url.protocol, url.host, config.server.base].join('/')) // srcDir + '@gen'

            url.pathname = url.pathname.startsWith(base)
                ? url.pathname.slice(base.length)
                : url.pathname

            const env = config.getEnv(url)

            const isBrowser = request.headers.get('user-agent')?.includes('Mozilla') ?? false;
            const isDocument = isBrowser && (request.headers.get('sec-fetch-dest') === 'document' || request.headers.get('x-dest') === 'document');

            const isSrc = url.searchParams.has(srcKey)
            const isOut = url.searchParams.has(outKey)


            const hasDash = init.protocol && url.searchParams.has('dash')
            if (hasDash)
                return Response.redirect(`${init.protocol + "://"}${url.host}${url.pathname}`)

            const validTypeValues = ['ts', 'js', null] as const
            const defaultTypeValue = isDocument ? 'ts' : isBrowser ? 'js' : 'ts'
            const typeKey = isSrc ? srcKey : isOut ? outKey : null
            const typeVal = (typeKey ? (url.searchParams.get(typeKey) || defaultTypeValue) : null) as 'ts' | 'js' | null

            if (!validTypeValues.includes(typeVal))
                return new Response(`Bad input: ${typeKey}=${typeVal}\nValid: ${srcKey}|${outKey} = ${validTypeValues.map(String).join('|')}\n`, { status: 400 })

            const format = typeVal
                ? typeVal === 'js'
                    ? 'javascript'
                    : 'typescript'
                : isBrowser
                    ? 'javascript'
                    : 'typescript'


            const srcFilePath = url.pathname.startsWith(homedir()) ? url.pathname : join(srcDir, url.pathname);

            const outBaseDir = typeVal
                ? join(genDir, typeVal)
                : isBrowser
                    ? join(genDir, 'js')
                    : join(genDir, 'ts')

            const outFilePath = format === 'javascript'
                ? join(outBaseDir, url.pathname).replace(/\.ts$/, '.ts.js')
                : join(outBaseDir, url.pathname)

            const outSrcFilePath = typeKey === 'src' && format === 'javascript'
                ? join(outBaseDir, 'src', url.pathname).replace(/\.ts$/, '.ts.js')
                : undefined

            const doEdit = url.searchParams.has('edit') || url.searchParams.has('open')
            const doEditType = url.searchParams.get('edit') || url.searchParams.get('open')
            const edit = doEditType === null || doEditType === '1' ? editUsingRedirect : editUsingExec
            // console.log(`[${request.method}] ${url.pathname} (${format}) [${typeKey}=${typeVal}]`)

            switch (request.method) {
                case 'POST':
                    return exec(request, srcFilePath);

                case 'GET': {

                    if (url.pathname.endsWith('.json')) {
                        return doEdit
                            ? edit(srcFilePath, loc.line, loc.column)
                            : read({
                                filePath: srcFilePath,
                                fileType: 'json',
                                transform: init.transform,
                                url: reqUrl,
                                request
                            })
                    }

                    if ((typeKey === 'src' && format === 'typescript') || !typeKey && isDocument)
                        return doEdit
                            ? edit(srcFilePath, loc.line, loc.column)
                            : read({ filePath: srcFilePath, fileType: format, transform: init.transform, url: reqUrl, request })

                    const hasChanged = await hasSourceFileChanged(
                        srcFilePath,
                        outSrcFilePath || outFilePath
                    );

                    if (hasChanged) {
                        console.log(`hasChanged:`, hasChanged, [srcFilePath, outSrcFilePath || outFilePath]);

                        await transformFile(srcFilePath, outFilePath, {
                            format,
                            fileName: url.pathname,
                            sourceMap: true,
                            sourceFilePath: outSrcFilePath,
                            envImportUrl: init.envImportUrl,
                            rpcImportUrl: init.rpcImportUrl,
                            hotImportUrl: init.hotImportUrl,
                            jsxImportSource: init.jsxImportUrl,
                            env
                        })
                    }

                    return doEdit
                        ? edit(outSrcFilePath || outFilePath, loc.line, loc.column)
                        : read({ filePath: outSrcFilePath || outFilePath, fileType: format, transform: init.transform, url: reqUrl, request })
                }

                default:
                    return new Response(null, {
                        status: 405,
                        statusText: 'Method Not Allowed'
                    });
            }
        }

    }
})

