import { walk } from "jsr:@std/fs@1.0.0/walk";
import path from "node:path";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { transform, type RPCTransformInit } from "./transform.ts";

export function parseLocation(input: string | URL): { url: string; line?: number; column?: number } {
    const url = new URL(input, "http://dummy"); // Fallback pentru parsing corect
    const pathMatch = url.pathname.match(/^(.*?):(\d+)?(?::(\d+))?$/);

    if (pathMatch) {
        const [, file, line, column] = pathMatch;
        return {
            url: url.origin + file + url.search, // Menține query-ul (?src=ts)
            line: line ? parseInt(line, 10) : undefined,
            column: column ? parseInt(column, 10) : undefined,
        };
    }

    return { url: String(input) };
}


export const fetchModule = (url: string) => url.startsWith('http')
    ? fetch(url).then(res => res.text())
    : readFile(url.replace('file://', ''), 'utf-8')

export async function fetchCallImport(input: {
    callImportUrl: string,
    callImportDir: string,
    callImportFileName: string,
    format: string,
}) {
    const {
        callImportUrl,
        callImportFileName,
        format,
    } = input;

    const callImportPath = input.format === 'javascript'
        ? path.join(input.callImportDir, input.callImportFileName + '.js')
        : path.join(input.callImportDir, input.callImportFileName)

    const callMod = await fetchModule(callImportUrl)

    await (await import('node:fs/promises')).mkdir(path.dirname(callImportPath), { recursive: true });

    if (format === 'typescript') {
        await writeFile(callImportPath, callMod)
    } else if (format === 'javascript') {
        const oxcTransform = await import('npm:oxc-transform@0.51.0');
        const transformed = oxcTransform.transform(callImportUrl, callMod, { sourcemap: true });
        transformed.map.sources = [callImportFileName || callImportPath]
        const sourceMappingURL = `\n//# sourceMappingURL=data:application/json;base64,${btoa(JSON.stringify(transformed.map))}`
        await writeFile(callImportPath, transformed.code + sourceMappingURL)
    }

    console.log(`   - ${callImportPath}`)
}

export function resolveCallImport(input: { callImportFileName: string, callImportDir: string, importer: string }) {
    const callImportPath = path.relative(path.dirname(input.importer), path.join(input.callImportDir, input.callImportFileName))

    return callImportPath.startsWith('../')
        ? callImportPath
        : `./${callImportPath}`
}

export async function transformDir(srcDir: string, outDir: string, options?: RPCTransformInit) {
    const start = performance.now();

    // srcDir = path.resolve(srcDir)
    // outDir = path.resolve(outDir)

    options = options || {}
    options.format = options.format || 'typescript'
    // call
    // options.callImportName = options.callImportName || '__call__'
    // options.callImportFileName = options.callImportFileName || '.call.ts'

    const outBaseDir = options?.format === 'javascript'
        ? path.join(outDir, 'js')
        : path.join(outDir, 'ts');

    // if (options?.callImportType === 'file') {
    //     await fetchCallImport({
    //         callImportUrl: options.callImportUrl || import.meta.resolve('./call.ts'),
    //         callImportDir: outBaseDir,
    //         callImportFileName: options.callImportFileName,
    //         format: options.format
    //     })
    // }

    console.log(`Processing directory: ${srcDir} -> ${outDir} ${options.format}`);

    for await (const entry of walk(srcDir, { exts: [".ts"] })) {
        const start = performance.now();

        const relativePath = options?.format === 'javascript'
            ? path.relative(srcDir, entry.path).replace(/\.ts$/, '.ts.js')
            : path.relative(srcDir, entry.path)


        const outFile = path.join(outBaseDir, relativePath);

        // if (options?.callImportType === 'file') {
        //     options.callImportUrl = resolveCallImport({
        //         importer: outFile,
        //         callImportDir: outBaseDir,
        //         callImportFileName: options.callImportFileName
        //     })
        // }

        await transformFile(entry.path, outFile, {
            ...options,
            fileName: path.relative(srcDir, entry.path)
        });

        console.log(`${outFile}`, `in`, performance.now() - start, `ms`);
    }

    console.log(`Time taken: `, performance.now() - start, `ms`);
}

export async function transformFile(srcFile: string, outFile: string, options?: RPCTransformInit & { sourceFilePath?: string }) {
    const isTsOrJs = srcFile.endsWith('.ts') || srcFile.endsWith('.mts') || srcFile.endsWith('.js') || srcFile.endsWith('.mjs') || srcFile.endsWith('.tsx') || srcFile.endsWith('.jsx')
    const source = await readFile(srcFile, "utf-8");
    const result = isTsOrJs
        ? await transform(srcFile, source, options)
        : { code: source, source: { code: source, map: undefined } }

    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, result.code);

    if (options?.sourceFilePath && options?.format === 'javascript') {
        result.source.map.sources = [options.fileName || srcFile]
        const sourceMappingURL = `\n//# sourceMappingURL=data:application/json;base64,${btoa(JSON.stringify(result.source.map))}`

        await mkdir(path.dirname(options.sourceFilePath), { recursive: true });
        await writeFile(options.sourceFilePath, result.source.code + sourceMappingURL)
    }
}

export async function hasSourceFileChanged(srcFile: string, outFile: string): Promise<boolean> {
    try {
        const srcStats = await stat(srcFile);
        const outStats = await stat(outFile);

        return srcStats.mtimeMs > outStats.mtimeMs;
    } catch (error: any) {
        return error.code === 'ENOENT' && error.path === outFile;
    }
}