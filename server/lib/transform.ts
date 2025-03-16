import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import process from "node:process";

export const CWD = process.cwd()
export const DENO_EXE = `${process.env.HOME}/.deno/bin/deno`
export const DENO_GEN_DIR = `${process.env.HOME}/Library/Caches/deno/gen/file`
export const RUNTIME = (navigator.userAgent.includes("Deno")
    ? 'deno'
    : navigator.userAgent.includes("Bun")
        ? 'bun'
        : navigator.userAgent.includes("Node")
            ? 'node'
            : 'unknown') as
    | 'deno'
    | 'bun'
    | 'node'
    | 'unknown';

export const isBrowser = (request: Request): boolean => {
    const userAgent = request.headers.get('User-Agent');
    if (!userAgent)
        return false

    return userAgent.includes('Chrome') || userAgent.includes('Firefox') || userAgent.includes('Safari')
}

export const isCurl = (request: Request): boolean => {
    const userAgent = request.headers.get('User-Agent');
    if (!userAgent)
        return false

    return userAgent.includes('curl')
}

export const isDocument = (request: Request): boolean => {
    if (!isBrowser(request))
        return false
    const fetchDest = request.headers.get('Sec-Fetch-Dest');

    return fetchDest !== null && (fetchDest === 'document' || fetchDest === 'iframe');
}

export const getGen = async (filePath: string) => {
    if (!filePath) return

    const startTime = Date.now()
    const srcPath = resolve(CWD, filePath.replace('file://', ''))
    const genPath = DENO_GEN_DIR + srcPath + '.js'

    try {

        // await import(srcPath)
        const res = cmdSync(DENO_EXE, ['cache', '--allow-import', srcPath])
        if (!res.success)
            console.log(res.stderr.toString())
        // console.log('getGen[ok]', relative(CWD, srcPath))
    } catch (e: any) {
        // console.log('getGen[error]', relative(CWD, srcPath), e)

        if (e.message.includes('ERR_MODULE_NOT_FOUND') || e.message.includes('Module not found'))
            throw new Error(`Source not found: ${relative(CWD, srcPath)}`, { cause: e })

        // console.log('absSrcPath', srcPath,)
        /** */
    }

    const code = await readFile(genPath, 'utf-8')

    console.log('getGen', relative(CWD, srcPath), Date.now() - startTime)

    return { srcPath, genPath, code }
}

export async function getGenCode(srcFilePath: string, _sourceFileToBeReplaced?: string): Promise<string> {
    const gen = await getGen(srcFilePath)
    if (!gen?.code) return ''

    const jslines = gen?.code.split('\n') || []
    jslines.pop() // remove // denoCacheMetadata
    const sourcemapLine = jslines.pop()!
    const inlineSourceMap = sourcemapLine.split('//# sourceMappingURL=')[1]
    const updatedInlineSourceMap = processInlineSourceMap(inlineSourceMap, (source) => _sourceFileToBeReplaced || source.split('/').pop()!);
    jslines.push(`//# sourceMappingURL=${updatedInlineSourceMap}`)
    const updatedJSCode = jslines.join('\n')

    return updatedJSCode
}

export function processInlineSourceMap(
    inlineSourceMap: string,
    replaceSources: (source: string) => string
): string {
    // Decode the inline source map (Base64 content after "data:application/json;base64,")
    const base64Content = inlineSourceMap.split(",")[1];
    const sourceMapContent = atob(base64Content);
    const sourceMapJson = JSON.parse(sourceMapContent);

    // Replace sources using the provided callback
    sourceMapJson.sources = sourceMapJson.sources.map(replaceSources);

    // Re-encode the modified source map into an inline Base64 format
    const updatedSourceMapContent = JSON.stringify(sourceMapJson);
    const updatedBase64Content = btoa(updatedSourceMapContent);

    return `data:application/json;base64,${updatedBase64Content}`;
}

export function cmdSync(execPath: string, args: string[], opts: { cwd?: string, env?: Record<string, string> } = {}) {

    opts.env = { PATH: process.env.PATH!, ...opts.env }

    switch (RUNTIME) {
        case "deno": {
            const result = new Deno.Command(
                execPath,
                {
                    args,
                    cwd: opts.cwd,
                    env: opts.env,
                    stdout: "piped",
                    stderr: "piped"
                },
            ).outputSync()

            return { success: result.success, stdout: result.stdout, stderr: result.stderr }
        }
        case "node":
        case "bun": {
            const result = spawnSync(execPath, args, {
                cwd: opts.cwd,
                env: opts.env,
                stdio: ['inherit', 'pipe', 'pipe']
            })
            return { success: result.status === 0, stdout: result.stdout, stderr: result.stderr }
        }
        default:
            throw new Error(`Unsupported runtime: ${RUNTIME}`);
    }
}