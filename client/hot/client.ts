import { HMRClient } from "./HMRClient.ts";
import { HMRContext } from "./HMRContext.ts";
import type { HotContext } from "./types.ts";

export const eventSource = new EventSource(import.meta.env.BASE_URL)

eventSource.addEventListener('open', (e: any) => console.log(`[rpc:sse] connected`, e.target.url))
eventSource.addEventListener('error', (e: any) => console.log(`[rpc:sse] errored, reloading...`, e.target.url, setTimeout(() => location.reload(), 10)))
eventSource.addEventListener('reload', (e) => e.data === currentUrl() && setTimeout(() => location.reload(), 10))
eventSource.addEventListener('change', (e) => hmrClient.update(JSON.parse(e.data)))

function currentUrl() {
    return location.origin + (location.pathname.endsWith('/')
        ? location.pathname + 'index.html'
        : location.pathname)
}


export function create(meta: ImportMeta): HotContext {
    return new HMRContext(hmrClient, meta.url)
}

export const hmrClient = new HMRClient(
    {
        error: (err) => console.error('[rpc]', err),
        debug: (...msg) => console.debug('[rpc]', ...msg),
    },
    async function importUpdatedModule({
        acceptedPath,
        version,
        explicitImportRequired,
        isWithinCircularImport,
    }) {
        const [acceptedPathWithoutQuery, query] = acceptedPath.split(`?`)
        const importUrl = acceptedPathWithoutQuery + `?${explicitImportRequired ? 'import&' : ''}version=${version}${query ? `&${query}` : ''}`
        const importPromise = import(importUrl)

        if (isWithinCircularImport) {
            importPromise.catch(() => {
                console.info(`[hmr] ${acceptedPath} failed to apply HMR as it's within a circular import. Reloading page to reset the execution order.`)
                setTimeout(() => location.reload(), 50)
            })
        }

        return await importPromise
    },
)