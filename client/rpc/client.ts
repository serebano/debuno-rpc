import type { RPCContext } from "./types.ts";

export function create(meta: ImportMeta): RPCContext {
    function rpc<T>(path: string, ...args: any[]): Promise<T> {
        return call(meta.url, path, ...args)
    }

    return Object.assign(rpc, { call, apply })
}

export function apply<T>(url: string, path: string, args: any[]): Promise<T> {
    return call(url, path, ...args)
}

export async function call<T>(url: string, path: string, ...args: any[]): Promise<T> {
    console.log(`${path}@${url}`, args);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, args }),
    });

    const contentType = res.headers.get('content-type') ?? 'text/plain';

    if (!res.ok) {
        throw new Error(`${await res.text()}`);
    }

    return contentType.startsWith('text/') && !contentType.endsWith('stream')
        ? await res.text()
        : contentType === 'application/json'
            ? await res.json()
            : res.body;
}