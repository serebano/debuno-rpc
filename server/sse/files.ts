import type { File, FileEvent, SSE, SSETarget } from "./types.ts";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getLangFromExt, readDir } from "../../utils/mod.ts";
import chokidar, { type FSWatcher } from "npm:chokidar"
import * as meta from '../meta/mod.ts'

const console = globalThis.console.extend('files')

export async function getFiles(init: { path: string, base: string, origin: string, endpoint: string, filter: (...args: any[]) => boolean }): Promise<File[]> {
    init.origin = new URL(init.origin).origin
    console.debug(`[get]`, [init.path, init.origin + init.base])

    return await readDir(init.path)
        .catch(() => [] as string[])
        .then(files => files
            .filter(init.filter)
            .map(path => {
                const base = init.base
                const file = pathToFileURL(join(init.path, path)).href
                const http = new URL(base + path, init.origin).href
                const version = meta.versions[http] || null
                const timestamp = meta.timestamps[http] || null
                const dependents = meta.dependents[http] || null
                const dependencies = meta.dependencies[http] || null
                const endpoint = init.endpoint
                // const lang = getLangFromExt(file)

                return {
                    // lang,
                    base,
                    path,
                    file,
                    http,
                    version,
                    endpoint,
                    timestamp,
                    dependents,
                    dependencies
                }
            })
        )
}

export function watchFiles(init: {
    path: string,
    base: string,
    origin: string | URL,
    endpoint: string,
    target: SSE | SSETarget,
    filter: (...args: any[]) => boolean
}, listener: (target: SSE | SSETarget, event: FileEvent) => void): FSWatcher {

    init.origin = new URL(init.origin).origin

    const { path, target, filter } = init
    console.debug(`[watch]`, path)

    const emit = (type: FileEvent['type']) => (path: string) => listener(target, createFileEvent({ type, path }, { path: init.path, base: init.base, endpoint: init.endpoint, origin: String(init.origin) }))
    const watcher = chokidar.watch(path, {
        ignored: (path, stats) => (stats?.isFile() && !filter(path)) as boolean,
        persistent: true,
        ignoreInitial: true,
    });

    return watcher
        .on('unlink', emit('removed'))
        .on('add', emit('added'))
        .on('change', emit('changed'))
}


function createFileEvent(event: { type: FileEvent['type'], path: string }, init: { path: string, base: string, endpoint: string, origin: string }): FileEvent {
    const type = event.type
    const base = init.base
    const path = event.path.replace(init.path + "/", '')
    const file = new URL(event.path, 'file://').href
    const http = new URL(base + path, init.origin).href
    const version = 0
    const endpoint = init.endpoint
    const timestamp = Date.now()
    // const lang = getLangFromExt(file)


    return { type, base, path, file, http, version, endpoint, timestamp, dependents: null, dependencies: null }
}