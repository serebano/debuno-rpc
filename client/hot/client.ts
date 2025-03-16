import { HMRClient } from "./HMRClient.ts";
import { HMRContext } from "./HMRContext.ts";

export function create(ownerPath: string): RPCHotContext {
    return new HMRContext(hmrClient, ownerPath)
}

export const eventSource = new EventSource(location.origin)

eventSource.addEventListener('open', () => {
    console.log(`EventSource#open`, eventSource.url)
})

eventSource.addEventListener('change', async (evm) => {
    const e = JSON.parse(evm.data) as { url: string, version: number, timestamp: number, importer: string }[]
    await hmrClient.update(e)
})

eventSource.addEventListener('reload', (evm) => {
    const url = evm.data
    const currentUrl = location.origin + (location.pathname.endsWith('/') ? location.pathname + 'index.html' : location.pathname)
    if (url === currentUrl) {
        pageReload()
    }
})

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
                pageReload()
            })
        }

        return await importPromise
    },
)

const debounceReload = (time: number) => {
    let timer: ReturnType<typeof setTimeout> | null
    return () => {
        if (timer) {
            clearTimeout(timer)
            timer = null
        }
        timer = setTimeout(() => {
            location.reload()
        }, time)
    }
}

const pageReload = debounceReload(50)