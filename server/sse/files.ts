import type { File, FileEvent, SSE, SSETarget } from "./types.ts";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readDir } from "../../utils/mod.ts";
import chokidar, { type FSWatcher } from "npm:chokidar"
import * as meta from '../meta.ts'

export async function getFiles(init: { path: string, base: string, origin: string, filter: (...args: any[]) => boolean }): Promise<File[]> {
    init.origin = new URL(init.origin).origin
    console.log(`getFiles(`, [init.path, init.origin + init.base], `)`)

    return await readDir(init.path)
        .catch(() => [] as string[])
        .then(files => files
            .filter(init.filter)
            .map(path => {
                const base = init.base
                const file = pathToFileURL(join(init.path, path)).href
                const http = new URL(base + path, init.origin).href
                const version = meta.versions[http] || null
                const dependents = meta.dependents[http] || null
                const dependencies = meta.dependencies[http] || null

                return {
                    base,
                    path,
                    file,
                    http,
                    version,
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
    target: SSE | SSETarget,
    listener: (target: SSE | SSETarget, event: FileEvent) => void,
    filter: (...args: any[]) => boolean
}): FSWatcher {

    init.origin = new URL(init.origin).origin

    const { path, base, origin, target, listener, filter } = init
    console.log(`watchFiles(`, [path, origin + base], `)`)

    const emit = (type: FileEvent['type']) => (path: string) => listener(target, createFileEvent({ type, path }, { path: init.path, base: init.base, origin: String(init.origin) }))
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


function createFileEvent(event: { type: FileEvent['type'], path: string }, init: { path: string, base: string, origin: string }): FileEvent {
    const type = event.type
    const base = init.base
    const path = event.path.replace(init.path + "/", init.base)
    const file = new URL(event.path, 'file://').href
    const http = new URL(path, init.origin).href
    const version = 0
    const timestamp = Date.now()

    return { type, base, path, file, http, version, timestamp, dependents: null, dependencies: null }
}