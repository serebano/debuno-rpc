import { pathToFileURL } from "node:url";
import { RPC_DIR } from "../config.ts";
import type { SSE, SSETarget, FileEvent, Endpoint, SyncEndpointsResult } from "./types.ts";
import { getChanges, md5 } from "../../utils/mod.ts";
import chokidar, { type FSWatcher } from "npm:chokidar"
import type { Config } from "../../types/config.ts";
import { atomicWriteJSON, readJSON } from "../../utils/json.ts";

export const ENDPOINTS_CONFIG_PATH = RPC_DIR + '/endpoints.json'
const MAX_FAILED = 2

let __endpoints__ = await readEndpoints()

const oid = (o: any) => md5([o.http, o.base, o.file].join('|'))

async function emitEvent(target: SSE | SSETarget) {
    const newOrigins = (await readEndpoints())

    const newIds = newOrigins.map(o => o.$oid)
    const oldIds = __endpoints__.map(o => o.$oid)

    const changes = getChanges(oldIds, newIds)

    if (changes.added.length) {
        for (const $oid of changes.added) {
            target.emit('endpoint', {
                kind: 'added',
                ...newOrigins.find(o => o.$oid === $oid)
            })
        }
    }

    if (changes.removed.length) {
        for (const $oid of changes.removed) {
            target.emit('endpoint', {
                kind: 'removed',
                ...__endpoints__.find(o => o.$oid === $oid)
            })
        }
    }

    if (changes.added.length || changes.removed.length) {
        target.emit('endpoints', newOrigins)
    }

    __endpoints__ = newOrigins
}

export function watchEndpointsConfig(target: SSE | SSETarget): FSWatcher {
    console.log(`[endpoints][watch]`, ENDPOINTS_CONFIG_PATH)

    const watcher = chokidar.watch(ENDPOINTS_CONFIG_PATH, {
        persistent: true,
        ignoreInitial: true,
    });

    return watcher
        .on('add', () => emitEvent(target))
        .on('change', () => emitEvent(target))
        .on('unlink', () => emitEvent(target));
}

export async function removeEndpoint(config: Config, origin: string, listener?: (o: { file: string; http: string; base: string; type: FileEvent['type']; }) => void) {
    const { path, base } = config.server
    const origins = await readEndpoints();
    const o = {
        $oid: '',
        file: String(path.startsWith('file:') ? path : pathToFileURL(path)),
        http: origin,
        base,
        status: 200,
        checks: 0,
        failed: 0
    };

    o.$oid = oid(o)
    const index = origins.findIndex(origin => origin.$oid === o.$oid);

    if (index !== -1) {
        origins.splice(index, 1);
        await atomicWriteJSON(ENDPOINTS_CONFIG_PATH, origins)

        if (listener)
            listener({ ...o, type: 'removed' });
    }

    return __endpoints__ = origins;
}

export async function addEndpoint(config: Config, origin: string, listener?: (o: { file: string; http: string; base: string; type: FileEvent['type']; }) => void) {
    const { path, base } = config.server
    const res = await syncEndpoints()
    const origins = res.newEndpoints // await getOrigins();
    const o = {
        $oid: '',
        file: String(path.startsWith('file:') ? path : pathToFileURL(path)),
        http: origin,
        base,
        endpoint: '',
        status: 200,
        checks: 0,
        failed: 0
    };

    o.endpoint = o.http + o.base
    o.$oid = oid(o)

    const exists = origins.find(origin => origin.$oid === o.$oid);

    if (!exists) {
        const no = __endpoints__ = [...origins, o];
        await atomicWriteJSON(ENDPOINTS_CONFIG_PATH, no)

        if (listener)
            await listener({ ...o, type: 'added' });

    } else {
        __endpoints__ = origins
    }

    return __endpoints__
}

export async function readEndpoints(): Promise<Endpoint[]> {
    try {
        return await readJSON(ENDPOINTS_CONFIG_PATH)
    } catch {
        return [];
    }
}

export async function checkEndpoints(): Promise<Endpoint[]> {
    const entries = await readEndpoints()

    return await Promise.all(entries.map(async entry => {
        entry.endpoint = entry.endpoint || (entry.http + entry.base)

        entry.failed = entry.failed || 0
        entry.checks = entry.checks || 0
        entry.status = entry.status || 0

        try {
            const response = await fetch(entry.endpoint, { method: 'HEAD' })

            return {
                ...entry,
                status: response.status,
                checks: entry.checks + 1,
                failed: response.status !== 200 ? entry.failed + 1 : 0
            }
        } catch (e: any) {
            // console.log(`[checkEndpoints]`, e.message, e.code)
            return {
                ...entry,
                status: 0,
                checks: entry.checks + 1,
                failed: entry.failed + 1
            }
        }
    }))
}

export async function syncEndpoints(): Promise<SyncEndpointsResult> {
    const allEndpoints = await checkEndpoints()
    const validEndpoints = allEndpoints.filter(endpoint => endpoint.status === 200)
    const failedEndpoints = allEndpoints.filter(endpoint => endpoint.status !== 200)
    const newEndpoints = allEndpoints.filter(endpoint => endpoint.status === 200 || endpoint.failed <= MAX_FAILED)

    const allIds = allEndpoints.map(o => o.$oid)
    const newIds = newEndpoints.map(o => o.$oid)

    const validIds = validEndpoints.map(o => o.$oid)

    const changes = getChanges(allIds, newIds)

    console.log('[endpoints][sync]', changes)

    await writeEndpoints(newEndpoints)

    return {
        allEndpoints,
        newEndpoints,
        validEndpoints,
        failedEndpoints,
        allIds,
        newIds,
        validIds,
        changes
    }
}


export async function writeEndpoints(endpoints: any[]) {
    await atomicWriteJSON(ENDPOINTS_CONFIG_PATH, endpoints)
}


export async function getEndpoints(sync = false): Promise<Endpoint[] | SyncEndpointsResult> {
    return sync
        ? await syncEndpoints()
        : await readEndpoints()
}