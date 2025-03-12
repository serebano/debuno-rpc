import path from "node:path";
import { exec } from "./exec.ts";
import { read } from "./read.ts";
import { open } from "./open.ts";
import { fetchCallImport, hasSourceFileChanged, parseLocation, resolveCallImport, transformFile } from "./utils.ts";
import { homedir } from "node:os";

/**
 * Creates a handler function that processes incoming requests.
 *
 * @param options An object containing the source and output directories.
 * @returns A function that processes incoming requests.
 */

export function createHandler(options: {
    srcDir: string;
    outDir?: string;
    srcKey?: string;
    outKey?: string;
    callImportType?: 'data' | 'file'
    callImportName?: string
    callImportFileName?: string
    callImportUrl?: string
    fileVersion?: Record<string, number>
    read?: (sourceCode: string, filePath: string, url: string, req: Request) => string | Response | Promise<string | Response>
}) {

    const srcDir = path.resolve(options.srcDir);
    const outDir = options.outDir ? path.resolve(options.outDir) : srcDir + '-out'

    const srcKey = options.srcKey || 'src' // path.basename(srcDir)
    const outKey = options.outKey || 'out' // path.basename(outDir)

    const callImportType = options.callImportType || 'data'
    const callImportName = options.callImportName || '__call__'

    const callImportUrl = options.callImportUrl || import.meta.resolve('./call.ts')
    const callImportFileName = options.callImportFileName || '.call.ts'

    console.log(`Source: [${srcKey}] ${srcDir}`);
    console.log(`Output: [${outKey}] ${outDir}`);
    // console.log(`callImportUrl: ${callImportUrl}`)

    return async function handler(request: Request): Promise<Response> {
        const loc = parseLocation(request.url)
        const url = new URL(loc.url);

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


        const srcFilePath = url.pathname.startsWith(homedir()) ? url.pathname : path.join(srcDir, url.pathname);

        const outBaseDir = typeVal
            ? path.join(outDir, typeVal)
            : isBrowser
                ? path.join(outDir, 'js')
                : path.join(outDir, 'ts')

        const outFilePath = format === 'javascript'
            ? path.join(outBaseDir, url.pathname).replace(/\.ts$/, '.ts.js')
            : path.join(outBaseDir, url.pathname)

        const outSrcFilePath = typeKey === 'src' && format === 'javascript'
            ? path.join(outBaseDir, 'src', url.pathname).replace(/\.ts$/, '.ts.js')
            : undefined

        const doOpen = url.searchParams.has('open')
        console.log(`[${request.method}] ${url.pathname} (${format}) [${typeKey}=${typeVal}]`)

        switch (request.method) {
            case 'POST':
                return exec(request, srcFilePath, options.fileVersion);

            case 'GET': {

                if ((typeKey === 'src' && format === 'typescript') || !typeKey && isDocument)
                    return doOpen
                        ? open(srcFilePath, loc.line, loc.column)
                        : read({ filePath: srcFilePath, fileType: format, transform: options.read, url: url.href, request })

                if (callImportType === 'file' && url.pathname === `/${callImportFileName}`) {
                    await fetchCallImport({
                        format,
                        callImportDir: outBaseDir,
                        callImportFileName,
                        callImportUrl
                    })

                    return doOpen
                        ? open(outFilePath, loc.line, loc.column)
                        : read({ filePath: outFilePath, fileType: format, transform: options.read, url: url.href, request })
                }


                const hasChanged = await hasSourceFileChanged(
                    srcFilePath,
                    outSrcFilePath || outFilePath
                );

                if (hasChanged) {
                    console.log(`hasChanged:`, hasChanged, [srcFilePath, outSrcFilePath || outFilePath]);

                    const callImportUrl = callImportType === 'file'
                        ? resolveCallImport({
                            importer: outFilePath,
                            callImportDir: outBaseDir,
                            callImportFileName
                        })
                        : undefined

                    await transformFile(srcFilePath, outFilePath, {
                        format,
                        fileName: url.pathname,
                        callImportName,
                        callImportUrl,
                        sourceMap: true,
                        sourceFilePath: outSrcFilePath
                    })
                }

                return doOpen
                    ? open(outSrcFilePath || outFilePath, loc.line, loc.column)
                    : read({ filePath: outSrcFilePath || outFilePath, fileType: format, transform: options.read, url: url.href, request })
            }

            default:
                return new Response(null, {
                    status: 405,
                    statusText: 'Method Not Allowed'
                });
        }
    }
}

