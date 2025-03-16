import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import config from "../config.ts";
import type { SSE, SSETarget, FileEvent } from "./types.ts";
import { getChanges } from "../../utils/mod.ts";
import chokidar, { type FSWatcher } from "npm:chokidar"
import process from "node:process";

export const originsFile = process.env.HOME + '/.rpcorigins.json'

let origins: {
    file: string;
    http: string;
}[] = []

async function emitOriginsEvent(target: SSE | SSETarget) {
    const newOrigins = (await getOrigins())
    const newOriginsHttp = newOrigins.map(o => o.http)
    const originsHttp = origins.map(o => o.http)
    const changes = getChanges(originsHttp, newOriginsHttp)

    target.emit('origins', newOrigins)

    if (changes.added.length) {
        for (const origin of changes.added) {
            target.emit('origin', {
                kind: 'added',
                ...newOrigins.find(o => o.http === origin)
            })
        }
    }

    if (changes.removed.length) {
        for (const origin of changes.removed) {
            target.emit('origin', {
                kind: 'removed',
                ...origins.find(o => o.http === origin)
            })
        }
    }

    origins = newOrigins
}


export function watchOrigins(target: SSE | SSETarget): FSWatcher {
    console.log(`watchOrigins(`, [originsFile], `)`)

    const watcher = chokidar.watch(originsFile, {
        persistent: true,
        ignoreInitial: true,
    });

    return watcher
        .on('add', () => emitOriginsEvent(target))
        .on('change', () => emitOriginsEvent(target))
        .on('unlink', () => emitOriginsEvent(target));
}

export async function removeOrigin(path: string, origin: string, listener?: (o: { file: string; http: string; type: FileEvent['type']; }) => void) {
    const origins = await getOrigins();
    const o = { file: path.startsWith('file:') ? path : pathToFileURL(path).href, http: origin };
    const index = origins.findIndex(origin => origin.file === o.file && origin.http === o.http);

    if (index !== -1) {
        origins.splice(index, 1);
        await writeFile(originsFile, JSON.stringify(origins, null, 2));
        if (listener)
            listener({ ...o, type: 'removed' });
    }

    return origins;
}

export async function addOrigin(path: string, origin: string, listener?: (o: { file: string; http: string; type: FileEvent['type']; }) => void) {
    const origins = await getOrigins();
    const o = { file: path.startsWith('file:') ? path : pathToFileURL(path).href, http: origin };
    const exists = !!origins.find(origin => origin.file === o.file && origin.http === o.http);

    if (!exists) {
        const no = [...origins, o];
        await writeFile(originsFile, JSON.stringify(no, null, 2));
        if (listener)
            listener({ ...o, type: 'added' });

        return no;
    }

    return origins;
}

export async function getOrigins(): Promise<{ file: string; http: string; }[]> {
    try {
        const text = await readFile(originsFile, 'utf-8');
        const json = JSON.parse(text);

        return json;
    } catch {
        return [];
    }
}

export function getOriginsSync(): { file: string; http: string; }[] {
    const text = readFileSync(originsFile, 'utf-8');
    const json = JSON.parse(text);

    return json;
}
