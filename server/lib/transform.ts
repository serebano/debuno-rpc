import path from "node:path";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { transform } from 'npm:oxc-transform@0.58.1'

export async function transformFile(srcFilePath: string, outFilePath: string, sourceMapFilePath?: string): Promise<string> {
    srcFilePath = srcFilePath.replace('file:///', '/')
    outFilePath = outFilePath.replace('file:///', '/')

    const source = await readFile(srcFilePath, 'utf-8')

    const transformed = transform(srcFilePath, source, {
        sourcemap: true
        // jsx: {
        //     importSource: 'https://esm.sh/preact@10.26.3',
        //     runtime: 'automatic'
        // },
    });

    let outFileSource = transformed.code

    if (transformed.map) {
        transformed.map.sources = [sourceMapFilePath || path.relative(outFilePath, srcFilePath)]
        const sourceMappingURL = `\n//# sourceMappingURL=data:application/json;base64,${btoa(JSON.stringify(transformed.map))}`
        outFileSource = outFileSource + sourceMappingURL
    }

    await mkdir(path.dirname(outFilePath), { recursive: true });
    await writeFile(outFilePath, outFileSource)

    console.log(`lib/transformFile( ${path.relative(process.cwd(), outFilePath)} )`)

    return outFileSource
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