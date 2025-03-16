import { join, resolve } from "node:path";
import { exec } from "./exec.ts";
import { read } from "./read.ts";
import { open } from "./open.ts";
import { hasSourceFileChanged, parseLocation, transformFile } from "./utils.ts";
import { homedir } from "node:os";

export interface RpcHandlerInit {
    base: string;
    genPath?: string;
    indexFileName?: string;
    srcKey?: string;
    outKey?: string;
    protocol?: string;
    callImportType?: 'data' | 'file'
    callImportName?: string
    callImportFileName?: string
    callImportUrl?: string
    fileVersion?: Record<string, number>
    read?: (sourceCode: string, filePath: string, url: string, req: Request) => string | Response | Promise<string | Response>
}

/**
 * Creates a handler function that processes incoming requests.
 *
 * @param init An object containing the source and output directories.
 * @returns A function that processes incoming requests.
 */

export function createRpcHandler(path: string, init: RpcHandlerInit): { path: string; base: string; handler: (request: Request) => Promise<Response>; } {
    const base = init.base || '/'
    const srcDir = resolve(path);
    const outDir = init.genPath ? resolve(init.genPath) : srcDir + '-gen'

    const srcKey = init.srcKey || 'src' // basename(srcDir)
    const outKey = init.outKey || 'out' // basename(outDir)

    // const callImportType = init.callImportType || 'data'
    // const callImportName = init.callImportName || '__call__'

    // const callImportUrl = init.callImportUrl || import.meta.resolve('./call.ts')
    // const callImportFileName = init.callImportFileName || '.call.ts'

    const indexFileName = init.indexFileName || 'index.html'

    console.log(`Source: [${srcKey}] ${srcDir}`);
    console.log(`Output: [${outKey}] ${outDir}`);
    // console.log(`callImportUrl: ${callImportUrl}`)

    async function handler(request: Request): Promise<Response> {
        const reqUrl = request.url.endsWith('/') ? request.url + indexFileName : request.url
        const loc = parseLocation(reqUrl)
        const url = new URL(loc.url);

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
            ? join(outDir, typeVal)
            : isBrowser
                ? join(outDir, 'js')
                : join(outDir, 'ts')

        const outFilePath = format === 'javascript'
            ? join(outBaseDir, url.pathname).replace(/\.ts$/, '.ts.js')
            : join(outBaseDir, url.pathname)

        const outSrcFilePath = typeKey === 'src' && format === 'javascript'
            ? join(outBaseDir, 'src', url.pathname).replace(/\.ts$/, '.ts.js')
            : undefined

        const doOpen = url.searchParams.has('open')
        // console.log(`[${request.method}] ${url.pathname} (${format}) [${typeKey}=${typeVal}]`)

        switch (request.method) {
            case 'POST':
                return exec(request, srcFilePath, init.fileVersion);

            case 'GET': {

                if (url.pathname.endsWith('.json')) {
                    return doOpen
                        ? open(srcFilePath, loc.line, loc.column)
                        : read({
                            filePath: srcFilePath,
                            fileType: 'json',
                            transform: init.read,
                            url: url.href,
                            request
                        })
                }

                if ((typeKey === 'src' && format === 'typescript') || !typeKey && isDocument)
                    return doOpen
                        ? open(srcFilePath, loc.line, loc.column)
                        : read({ filePath: srcFilePath, fileType: format, transform: init.read, url: url.href, request })

                // if (callImportType === 'file' && url.pathname === `/${callImportFileName}`) {
                //     await fetchCallImport({
                //         format,
                //         callImportDir: outBaseDir,
                //         callImportFileName,
                //         callImportUrl
                //     })

                //     return doOpen
                //         ? open(outFilePath, loc.line, loc.column)
                //         : read({ filePath: outFilePath, fileType: format, transform: init.read, url: url.href, request })
                // }


                const hasChanged = await hasSourceFileChanged(
                    srcFilePath,
                    outSrcFilePath || outFilePath
                );

                if (hasChanged) {
                    console.log(`hasChanged:`, hasChanged, [srcFilePath, outSrcFilePath || outFilePath]);

                    // const callImportUrl = callImportType === 'file'
                    //     ? resolveCallImport({
                    //         importer: outFilePath,
                    //         callImportDir: outBaseDir,
                    //         callImportFileName
                    //     })
                    //     : undefined

                    await transformFile(srcFilePath, outFilePath, {
                        format,
                        fileName: url.pathname,
                        // callImportName,
                        // callImportUrl,
                        sourceMap: true,
                        sourceFilePath: outSrcFilePath
                    })
                }

                return doOpen
                    ? open(outSrcFilePath || outFilePath, loc.line, loc.column)
                    : read({ filePath: outSrcFilePath || outFilePath, fileType: format, transform: init.read, url: url.href, request })
            }

            default:
                return new Response(null, {
                    status: 405,
                    statusText: 'Method Not Allowed'
                });
        }
    }

    return {
        path,
        base,
        handler
    }
}

