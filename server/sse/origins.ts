import { readFileSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { RPC_DIR } from "../config.ts";
import type { SSE, SSETarget, FileEvent } from "./types.ts";
import { getChanges } from "../../utils/mod.ts";
import chokidar, { type FSWatcher } from "npm:chokidar"
import type { Config } from "../../types/config.ts";

export const originsFile = RPC_DIR + '/origins.json'

let origins: {
    file: string;
    http: string;
    base: string;
}[] = []

const toId = (o: any) => [o.file, o.http, o.base].join('|')

async function emitOriginsEvent(target: SSE | SSETarget) {
    const newOrigins = (await getOrigins())
    const newOriginsHttp = newOrigins.map(toId)
    const originsHttp = origins.map(toId)
    const changes = getChanges(originsHttp, newOriginsHttp)

    target.emit('origins', newOrigins)

    if (changes.added.length) {
        for (const origin of changes.added) {
            target.emit('origin', {
                kind: 'added',
                ...newOrigins.find(o => toId(o) === origin)
            })
        }
    }

    if (changes.removed.length) {
        for (const origin of changes.removed) {
            target.emit('origin', {
                kind: 'removed',
                ...origins.find(o => toId(o) === origin)
            })
        }
    }

    origins = newOrigins
}


export function watchOrigins(target: SSE | SSETarget): FSWatcher {
    console.log(`watchOrigins( ${originsFile} )`)

    const watcher = chokidar.watch(originsFile, {
        persistent: true,
        ignoreInitial: true,
    });

    return watcher
        .on('add', () => emitOriginsEvent(target))
        .on('change', () => emitOriginsEvent(target))
        .on('unlink', () => emitOriginsEvent(target));
}

export async function removeOrigin(config: Config, origin: string, listener?: (o: { file: string; http: string; base: string; type: FileEvent['type']; }) => void) {
    const { path, base } = config.server
    const origins = await getOrigins();
    const o = {
        file: String(path.startsWith('file:') ? path : pathToFileURL(path)),
        http: origin,
        base
    };

    const index = origins.findIndex(origin => toId(origin) === toId(o));

    if (index !== -1) {
        origins.splice(index, 1);
        await writeFile(originsFile, JSON.stringify(origins, null, 2));
        if (listener)
            listener({ ...o, type: 'removed' });
    }

    return origins;
}

export async function addOrigin(config: Config, origin: string, listener?: (o: { file: string; http: string; base: string; type: FileEvent['type']; }) => void) {
    const { path, base } = config.server
    const origins = await getOrigins();
    const o = {
        file: String(path.startsWith('file:') ? path : pathToFileURL(path)),
        http: origin,
        base
    };
    const exists = !!origins.find(origin => toId(origin) === toId(o));

    if (!exists) {
        const no = [...origins, o];
        await writeFile(originsFile, JSON.stringify(no, null, 2));
        if (listener)
            listener({ ...o, type: 'added' });

        return no;
    }

    return origins;
}

export async function getOrigins(): Promise<{ file: string; http: string; base: string; }[]> {
    try {
        const text = await readFile(originsFile, 'utf-8');
        const json = JSON.parse(text);

        return json;
    } catch {
        return [];
    }
}

export function getOriginsSync(): { file: string; http: string; base: string; }[] {
    const text = readFileSync(originsFile, 'utf-8');
    const json = JSON.parse(text);

    return json;
}
