import { readFileSync } from "node:fs";
import * as meta from '../server/meta/mod.ts'
import process from "node:process";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";

export const fileExists = async (path: string) => {
    try {
        await fs.access(path, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
};

export function mapToSet(config: Record<string, string>): {
    path: string;
    port: number;
    base: string;
}[] {
    return Object.keys(config)
        .map(addr => {
            const [port, ...base] = addr.split('/');

            return {
                path: config[addr],
                port: Number(port) || 0,
                base: base.join('/')
            };
        });
}

export function open(openUri: string): Promise<void> {
    console.log(`open(${openUri})`)

    return new Promise<void>((resolve, reject) => {
        execFile('open', [openUri], (error, _stdout, _stderr) => {
            if (error)
                reject(error)
            else
                resolve()
        });
    })
}

export function groupByDeep<T>(arr: T[], keyPath: string): Record<string, T[]> {
    return arr.reduce((acc, obj) => {
        const keys = keyPath.split(".");
        // @ts-ignore .
        const groupKey = keys.reduce((val, key) => val?.[key], obj) as unknown as string;
        if (groupKey !== undefined) {
            (acc[groupKey] ||= []).push(obj);
        }
        return acc;
    }, {} as Record<string, T[]>);
}

export function groupBy<T, K extends keyof T>(arr: T[], key: K): Record<T[K] & PropertyKey, T[]> {
    return arr.reduce((acc, obj) => {
        const groupKey = obj[key] as T[K] & PropertyKey;
        (acc[groupKey] ||= []).push(obj);
        return acc;
    }, {} as Record<T[K] & PropertyKey, T[]>);
}

export function md5(str: string): string {
    return createHash("md5").update(str).digest("hex");
}


export function getCliArgs() {
    const path = (process.argv.slice(2)[0]?.split(':')[0] || '.')
    const port = parseInt(process.argv.slice(2)[0]?.split(':')[1] || '8080')
    const base = (process.argv.slice(2)[0]?.split(':')[2] || '/')

    return { path, port, base }
}

export function getDenoConfig(path: string): Record<string, any> {
    try {
        return JSON.parse(readFileSync(path + '/deno.json', 'utf-8'))
    } catch {
        return {}
    }
}

export const formatBase = (i = "/") => !i || i === '/' ? '/' : '/' + i.split('/').filter(Boolean).join('/') + '/'

export function getFileExtension(filename: string): string | null {
    const match = filename.match(/\.([a-zA-Z0-9.]+)$/);
    return match ? match[1] : null;
}

// Create an element with provided attributes and optional children
export function h(
    e: string,
    attrs: Record<string, string> = {},
    ...children: (string | Node)[]
) {
    const elem = document.createElement(e)
    for (const [k, v] of Object.entries(attrs)) {
        elem.setAttribute(k, v)
    }
    elem.append(...children)
    return elem
}

const mimeTypes: Record<string, string> = {
    "html": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "json": "application/json",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "svg": "image/svg+xml",
    "pdf": "application/pdf",
    "txt": "text/plain",
    "mp3": "audio/mpeg",
    "mp4": "video/mp4",
};

export function getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? mimeTypes[ext] : 'text/plain';
}

export function resolvePath(fileName: string | URL, base?: string | URL) {
    return new URL(fileName, base).pathname
}

export function moduleVersionTransform(source: string, file: string, http: string) {
    console.log(`   * deps version sync`)
    // console.log('moduleVersionTransform(', [file, http], ')')

    const parentUrl = new URL(http)
    const parentId = parentUrl.origin + parentUrl.pathname

    return replaceImportAndExportPaths(source, (importPath) => {
        if (
            importPath.endsWith('.ts') ||
            importPath.endsWith('.tsx') ||
            importPath.endsWith('.js') ||
            importPath.endsWith('.jsx') ||
            importPath.endsWith('.json')
        ) {

            const depUrl = new URL(importPath, parentId)
            const depId = depUrl.origin + depUrl.pathname

            meta.dependents[depId] = meta.dependents[depId] || {}
            meta.dependents[depId][parentId] = meta.versions[parentId] || null //httpDependents[depId][parentId] || {}

            meta.dependencies[parentId] = meta.dependencies[parentId] || {}
            meta.dependencies[parentId][depId] = meta.versions[depId] || null // httpDependencies[parentId][depId] || {}

            if (!meta.versions[depId])
                return importPath

            depUrl.searchParams.set('version', String(meta.versions[depId] || 1))

            return [importPath.split('?').shift(), depUrl.searchParams].filter(Boolean).join('?')
        }

        return importPath
    })
}

export function moduleHtmlTransform(source: string, file: string, http: string, req: Request) {
    const isDocument = req.headers.get('sec-fetch-dest') === 'document' || req.headers.get('x-fetch-dest') === 'document'
    const isHtml = !!(['html', 'htm'] as const).find(ext => file.endsWith('.' + ext))

    if (isDocument && !isHtml) {
        const editLine = (line: number) => {
            const url = new URL(req.url)
            url.pathname = url.pathname + ':' + line
            url.searchParams.set('edit', '')
            return String(url)
        }
        const lines = source.split('\n')
        const sourceCode = lines.map((line, index) => {
            return [
                `<a title="Edit line ${index + 1}" href="${editLine(index + 1)}">`,
                `<i>${index + 1}</i>`,
                `<span>${line.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</span>`,
                `</a>`
            ].join('')
        }).join('')

        return new Response([
            `<style>`,
            `body{background:#282828;font-size:14px;line-height:1.5;color:#ccc;margin:0;padding:0px;}`,
            `pre{margin:10px;font-family: Menlo, Monaco, Courier New, monospace;line-height: 24px;font-weight: 400;font-size: 13px;font-feature-settings: "liga" 0, "calt" 0;overflow: hidden;font-variation-settings: normal;letter-spacing: 0px;}`,
            `a{color:inherit;text-decoration:none;display:flex;line-height:24px;gap:10px}`,
            `a:hover{background:rgba(0,0,0,0.2)}`,
            `a i{display:block;min-width:20px;text-align:right;padding:0 10px;font-style:normal;opacity:0.4}`,
            `</style>`,
            `<pre>${sourceCode}</pre>`
        ].join(''), {
            headers: {
                'content-type': 'text/html',
                'x-file-path': file
            }
        })
    }

    return source
}

export function getChanges(oldArray: string[], newArray: string[]): { added: string[]; removed: string[]; } {
    const oldSet = new Set(oldArray);
    const newSet = new Set(newArray);

    const added = newArray.filter(item => !oldSet.has(item));
    const removed = oldArray.filter(item => !newSet.has(item));

    return { added, removed };
}

export function replaceImportAndExportPaths(
    sourceCode: string,
    linkMapper: (importPath: string) => string
): string {
    // Regex to match:
    // - Static imports/exports: `import ... from '...'` or `export ... from '...'`
    // - Dynamic imports: `import('...')`
    // - Import assertions: `import ... from '...' with { type: 'json' }`
    // - HTML script tag `src` attributes: `<script src="..."></script>`
    const importExportScriptRegex = /(?<=\b(?:import|export)\s+[^'"]*['"]|import\s*\(['"]|<script[^>]+?\bsrc=['"])([^'"]+)(?=['"](?:\s+with\s*\{[^}]*\})?)/g;

    return sourceCode.replace(importExportScriptRegex, (importPath) => {
        return linkMapper(importPath);
    });
}

export async function readDir(dirPath: string): Promise<string[]> {
    const fs = await import('node:fs/promises');
    dirPath = dirPath.replace('file://', '');
    dirPath = await import('node:path').then((m) => m.resolve(dirPath))

    const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true });

    return entries
        .filter(entry => entry.isFile())
        .map(entry => (entry.parentPath.endsWith('/') ? entry.parentPath : entry.parentPath + "/") + entry.name)
        .map(filePath => filePath.replace(dirPath, ''))
        .map(filePath => filePath.startsWith('/') ? filePath.slice(1) : filePath) //.replace(dirPath.endsWith('/') ? dirPath : dirPath + '/', ''))
}