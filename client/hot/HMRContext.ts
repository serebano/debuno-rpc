import type { HMRClient } from "./HMRClient.ts";
import type { CustomListenersMap, HotCallback, HotModule } from "./types.ts";

export class HMRContext implements RPCHotContext {
    private newListeners: CustomListenersMap

    constructor(
        private hmrClient: HMRClient,
        private ownerPath: string,
    ) {
        const url = new URL(ownerPath)
        url.searchParams.delete('version')

        this.ownerPath = ownerPath = String(url)

        console.log(`new HMRContext`, { ownerPath })

        if (!hmrClient.dataMap.has(ownerPath)) {
            hmrClient.dataMap.set(ownerPath, {})
        }

        // when a file is hot updated, a new context is created
        // clear its stale callbacks
        const mod = hmrClient.hotModulesMap.get(ownerPath)
        if (mod) {
            mod.callbacks = []
        }

        // clear stale custom event listeners
        const staleListeners = hmrClient.ctxToListenersMap.get(ownerPath)
        if (staleListeners) {
            for (const [event, staleFns] of staleListeners) {
                const listeners = hmrClient.customListenersMap.get(event)
                if (listeners) {
                    hmrClient.customListenersMap.set(
                        event,
                        listeners.filter((l) => !staleFns.includes(l)),
                    )
                }
            }
        }

        this.newListeners = new Map()
        hmrClient.ctxToListenersMap.set(ownerPath, this.newListeners)
    }

    get data(): any {
        return this.hmrClient.dataMap.get(this.ownerPath)
    }

    accept(deps?: any, callback?: any): void {
        if (typeof deps === 'function' || !deps) {
            // self-accept: hot.accept(() => {})
            this.acceptDeps([this.ownerPath], ([mod]) => deps?.(mod))
        } else if (typeof deps === 'string') {
            // explicit deps
            this.acceptDeps([deps], ([mod]) => callback?.(mod))
        } else if (Array.isArray(deps)) {
            this.acceptDeps(deps, callback)
        } else {
            throw new Error(`invalid hot.accept() usage.`)
        }
    }

    // export names (first arg) are irrelevant on the client side, they're
    // extracted in the server for propagation
    acceptExports(
        _: string | readonly string[],
        callback?: (data: any) => void,
    ): void {
        this.acceptDeps([this.ownerPath], ([mod]) => callback?.(mod))
    }

    dispose(cb: (data: any) => void): void {
        this.hmrClient.disposeMap.set(this.ownerPath, cb)
    }

    prune(cb: (data: any) => void): void {
        this.hmrClient.pruneMap.set(this.ownerPath, cb)
    }

    // Kept for backward compatibility (#11036)
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    decline(): void { }

    invalidate(message: string): void {
        this.hmrClient.notifyListeners('hmr:invalidate', {
            path: this.ownerPath,
            message,
        })
        this.hmrClient.logger.debug(
            `invalidate ${this.ownerPath}${message ? `: ${message}` : ''}`,
        )
    }

    on<T extends string>(
        event: T,
        cb: (payload: InferCustomEventPayload<T>) => void,
    ): void {
        const addToMap = (map: Map<string, any[]>) => {
            const existing = map.get(event) || []
            existing.push(cb)
            map.set(event, existing)
        }
        addToMap(this.hmrClient.customListenersMap)
        addToMap(this.newListeners)
    }

    off<T extends string>(
        event: T,
        cb: (payload: InferCustomEventPayload<T>) => void,
    ): void {
        const removeFromMap = (map: Map<string, any[]>) => {
            const existing = map.get(event)
            if (existing === undefined) {
                return
            }
            const pruned = existing.filter((l) => l !== cb)
            if (pruned.length === 0) {
                map.delete(event)
                return
            }
            map.set(event, pruned)
        }
        removeFromMap(this.hmrClient.customListenersMap)
        removeFromMap(this.newListeners)
    }

    private acceptDeps(
        deps: string[],
        callback: HotCallback['fn'] = () => { },
    ): void {
        deps = deps.map(dep => {
            const url = new URL(dep, this.ownerPath)
            url.searchParams.delete('version')
            url.searchParams.delete('t')

            return String(url)
        })

        const mod: HotModule = this.hmrClient.hotModulesMap.get(this.ownerPath) || {
            id: this.ownerPath,
            callbacks: [],
        }
        mod.callbacks.push({
            deps,
            fn: callback,
        })
        this.hmrClient.hotModulesMap.set(this.ownerPath, mod)
    }
}