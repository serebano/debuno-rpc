import { join } from "node:path";
import { exec } from "./exec.ts";
import { read } from "./read.ts";
import { editUsingExec, editUsingRedirect } from "./edit.ts";
import { hasSourceFileChanged, parseLocation, transformFile } from "./utils.ts";
import { homedir } from "node:os";
import { createRoute } from "../../utils/router.ts";
import { RPC_PRO_DIR } from "../config.ts";
import { getLangFromExt, moduleHtmlTransform, moduleVersionTransform, removeInlineSourceMap } from "../../utils/mod.ts";
import { readFile } from "node:fs/promises";
import path from "node:path";
import meta from "../meta/mod.ts";

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

export default createRoute((app) => {
    const init: RpcHandlerInit = {
        jsxImportUrl: app.config.shared.jsxImportUrl,
        rpcImportUrl: app.config.client.rpcImportUrl,
        hotImportUrl: app.config.client.hotImportUrl,
        envImportUrl: app.config.client.envImportUrl,
        protocol: app.config.protocol,
        srcKey: app.config.srcKey,
        outKey: app.config.genKey,
        genDir: app.config.genDir
    }

    // const { path, base } = app.config.server



    init.transform = init.transform || function transform(code, file, http, req) {
        code = moduleVersionTransform(code, file, http, app)
        code = moduleHtmlTransform(code, file, http, req) as string

        return code
    }

    return {
        match(request, url) {
            return ['GET', 'POST'].includes(request.method) && url.pathname.startsWith(app.config.server.base)
        },
        async fetch(request, url): Promise<Response> {
            const srcDir = (app.config.server.path);
            const srcKey = init.srcKey || 'src' // basename(srcDir)
            const outKey = init.outKey || 'out' // basename(outDir)
            const indexFileName = init.indexFileName || 'index.html'

            const reqUrl = url.pathname.endsWith('/') ? url.href + indexFileName : url.href
            const loc = parseLocation(reqUrl)
            url = new URL(loc.url);

            const genDir = init.genDir
                ? join(init.genDir, app.config.server.base)
                : RPC_PRO_DIR + ('/' + [url.protocol, url.host, app.config.server.base].join('/')) // srcDir + '@gen'

            url.pathname = url.pathname.startsWith(app.config.server.base)
                ? url.pathname.slice(app.config.server.base.length)
                : url.pathname

            const env = app.config.getEnv(url)
            const paths = {} as Record<string, string>

            const isInfo = url.searchParams.has('info')
            const isBrowser = request.headers.get('user-agent')?.includes('Mozilla') ?? false;
            const isDocument = isBrowser && (request.headers.get('sec-fetch-dest') === 'document' || request.headers.get('x-dest') === 'document');

            const isSrc = url.searchParams.has(srcKey)
            const isOut = url.searchParams.has(outKey)

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

            paths.original = srcFilePath
            paths.originalJs = join(genDir, 'js', 'src', url.pathname).replace(/\.ts$/, '.ts.js').replace(/\.tsx$/, '.tsx.js')
            paths.genTs = join(genDir, 'ts', url.pathname)
            paths.genJs = join(genDir, 'js', url.pathname).replace(/\.ts$/, '.ts.js').replace(/\.tsx$/, '.tsx.js')

            const outBaseDir = typeVal
                ? join(genDir, typeVal)
                : isBrowser
                    ? join(genDir, 'js')
                    : join(genDir, 'ts')

            const outFilePath = format === 'javascript'
                ? join(outBaseDir, url.pathname).replace(/\.ts$/, '.ts.js').replace(/\.tsx$/, '.tsx.js')
                : join(outBaseDir, url.pathname)


            const fileLang = getLangFromExt(url.pathname)

            const outSrcFilePath = typeKey === 'src' && format === 'javascript' && fileLang === 'typescript'
                ? join(outBaseDir, 'src', url.pathname).replace(/\.ts$/, '.ts.js').replace(/\.tsx$/, '.tsx.js')
                : undefined

            const doEdit = url.searchParams.has('edit') || url.searchParams.has('open')
            const doEditType = url.searchParams.get('edit') || url.searchParams.get('open')
            const edit = doEditType === null || doEditType === '1' ? editUsingRedirect : editUsingExec
            // console.log(`[${request.method}] ${url.pathname} (${format}) [${typeKey}=${typeVal}]`)

            async function transformIfChanged({ srcFilePath, outFilePath, outSrcFilePath, format }: { srcFilePath: string, outFilePath: string, outSrcFilePath?: string, format: "javascript" | "typescript" }) {
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
            }

            switch (request.method) {
                case 'POST':
                    return exec(request, srcFilePath);

                case 'GET': {

                    if (isInfo) {
                        const u = new URL(reqUrl)
                        const fileUrl = u.origin + u.pathname
                        const fileLang = getLangFromExt(fileUrl)
                        const lang = url.searchParams.get('lang') || fileLang
                        const hasGenerated = fileLang === 'javascript' || fileLang === 'typescript'

                        if (hasGenerated) {
                            await transformIfChanged({
                                srcFilePath: paths.original,
                                outFilePath: fileLang === 'javascript' || lang === 'javascript'
                                    ? paths.genJs
                                    : paths.genTs,
                                outSrcFilePath: fileLang === 'typescript' && lang === 'javascript'
                                    ? paths.originalJs
                                    : undefined,
                                format: fileLang === 'javascript' || lang === 'javascript'
                                    ? "javascript"
                                    : "typescript"
                            })
                        }


                        const originalPath = fileLang === 'javascript'
                            ? paths.original
                            : lang === 'javascript' ? paths.originalJs : paths.original
                        const generatedPath = fileLang === 'javascript' || lang === 'javascript'
                            ? paths.genJs
                            : paths.genTs

                        const sources = {
                            original: {
                                path: originalPath,
                                lang: getLangFromExt(originalPath),
                                contents: moduleVersionTransform(
                                    await readFile(originalPath, 'utf-8').then(removeInlineSourceMap),
                                    originalPath,
                                    fileUrl,
                                    app
                                )
                            },
                            generated: hasGenerated ? {
                                path: generatedPath,
                                lang: getLangFromExt(generatedPath),
                                contents: moduleVersionTransform(
                                    await readFile(generatedPath, 'utf-8').then(removeInlineSourceMap),
                                    generatedPath,
                                    fileUrl,
                                    app
                                )
                            } : null
                        }

                        const data = {
                            lang,
                            http: fileUrl,
                            file: paths.original,
                            base: app.config.server.base,
                            path: u.pathname.slice(app.config.server.base.length),
                            endpoint: app.config.server.endpoint,
                            ...meta.get(fileUrl),
                            sources,
                            // paths
                        }

                        return new Response(JSON.stringify(data, null, 4), {
                            headers: {
                                'content-type': 'application/json'
                            }
                        })
                    }

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

                    if ((typeKey === 'src' && (format === 'typescript' || fileLang === 'javascript')) || !typeKey && isDocument)
                        return doEdit
                            ? edit(srcFilePath, loc.line, loc.column)
                            : read({ filePath: srcFilePath, fileType: format, transform: init.transform, url: reqUrl, request })



                    await transformIfChanged({ srcFilePath, outFilePath, outSrcFilePath, format })
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

