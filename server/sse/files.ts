import type { File, FileEvent, SSE, SSETarget } from "./types.ts";
import config from "../config.ts";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readDir } from "../../utils/mod.ts";
import chokidar, { type FSWatcher } from "npm:chokidar"
import * as meta from '../meta.ts'

export async function getFiles(path: string, origin: string): Promise<File[]> {
    origin = new URL(origin).origin

    console.log(`getFiles(`, [path, origin], `)`)

    return await readDir(path)
        .catch(() => [] as string[])
        .then(files => files
            .filter(config.filter)
            .map(name => {
                const file = pathToFileURL(join(path, name)).href
                const http = new URL(name, origin).href
                const version = meta.versions[http] || null
                const dependents = meta.dependents[http] || null
                const dependencies = meta.dependencies[http] || null

                return {
                    path: '/' + name,
                    file,
                    http,
                    version,
                    dependents,
                    dependencies
                }
            })
        )
}

export function watchFiles(
    path: string,
    origin: string | URL, target: SSE | SSETarget,
    listener: (target: SSE | SSETarget, event: FileEvent) => void
): FSWatcher {
    origin = new URL(origin).origin
    console.log(`watchFiles(`, [path, origin], `)`)

    const init = { path, origin }
    const emit = (kind: FileEvent['type']) => (path: string) => listener(target, createFileEvent({ kind, path }, init))
    const watcher = chokidar.watch(path, {
        ignored: (path, stats) => (stats?.isFile() && !config.filter(path)) as boolean,
        persistent: true,
        ignoreInitial: true,
    });

    return watcher
        .on('unlink', emit('removed'))
        .on('add', emit('added'))
        .on('change', emit('changed'))
}


function createFileEvent(event: { kind: FileEvent['type'], path: string }, init: { path: string, origin: string }): FileEvent {
    const type = event.kind
    const file = new URL(event.path, 'file://').href
    const http = new URL(event.path.replace(init.path, ''), init.origin).href
    const path = event.path.replace(init.path, '')
    const version = 0
    const timestamp = Date.now()

    return { type, path, file, http, version, timestamp, dependents: null, dependencies: null }
}