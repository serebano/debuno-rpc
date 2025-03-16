// deno-lint-ignore-file no-explicit-any
import type { CustomListenersMap, HMRLogger, HotModule, HotUpdate } from "./types.ts";

export class HMRClient {
    public hotModulesMap = new Map<string, HotModule>()
    public disposeMap = new Map<string, (data: any) => void | Promise<void>>()
    public pruneMap = new Map<string, (data: any) => void | Promise<void>>()
    public dataMap = new Map<string, any>()
    public customListenersMap: CustomListenersMap = new Map()
    public ctxToListenersMap = new Map<string, CustomListenersMap>()

    constructor(
        public logger: HMRLogger,
        // This allows implementing reloading via different methods depending on the environment
        private importUpdatedModule: (update: HotUpdate) => Promise<ModuleNamespace>,
    ) {
        Object.assign(globalThis, { hmrClient: this })
    }

    public async notifyListeners<T extends string>(
        event: T,
        data: InferCustomEventPayload<T>,
    ): Promise<void>

    public async notifyListeners(event: string, data: any): Promise<void> {
        const cbs = this.customListenersMap.get(event)
        if (cbs) {
            await Promise.allSettled(cbs.map((cb) => cb(data)))
        }
    }

    public clear(): void {
        this.hotModulesMap.clear()
        this.disposeMap.clear()
        this.pruneMap.clear()
        this.dataMap.clear()
        this.customListenersMap.clear()
        this.ctxToListenersMap.clear()
    }

    // After an HMR update, some modules are no longer imported on the page
    // but they may have left behind side effects that need to be cleaned up
    // (e.g. style injections)
    public async prunePaths(paths: string[]): Promise<void> {
        await Promise.all(
            paths.map((path) => {
                const disposer = this.disposeMap.get(path)
                if (disposer) return disposer(this.dataMap.get(path))
            }),
        )
        paths.forEach((path) => {
            const fn = this.pruneMap.get(path)
            if (fn) {
                fn(this.dataMap.get(path))
            }
        })
    }

    protected warnFailedUpdate(err: Error, path: string | string[]): void {
        if (!err.message.includes('fetch')) {
            this.logger.error(err)
        }
        this.logger.error(
            `Failed to reload ${path}. ` +
            `This could be due to syntax errors or importing non-existent ` +
            `modules. (see errors above)`,
        )
    }

    private updateQueue: Promise<(() => void) | undefined>[] = []
    private pendingUpdateQueue = false

    /**
     * buffer multiple hot updates triggered by the same src change
     * so that they are invoked in the same order they were sent.
     * (otherwise the order may be inconsistent because of the http request round trip)
     */
    public async queueUpdate(payload: HotUpdate): Promise<void> {
        this.updateQueue.push(this.fetchUpdate(payload))
        if (!this.pendingUpdateQueue) {
            this.pendingUpdateQueue = true
            await Promise.resolve()
            this.pendingUpdateQueue = false
            const loading = [...this.updateQueue]
            this.updateQueue = []
                ; (await Promise.all(loading)).forEach((fn) => fn && fn())
        }
    }

    private async fetchUpdate(update: HotUpdate): Promise<(() => void) | undefined> {
        const { path, acceptedPath } = update
        const mod = this.hotModulesMap.get(path)
        if (!mod) {
            // In a code-splitting project,
            // it is common that the hot-updating module is not loaded yet.
            // https://github.com/vitejs/vite/issues/721
            return
        }

        let fetchedModule: ModuleNamespace | undefined
        const isSelfUpdate = path === acceptedPath

        // determine the qualified callbacks before we re-import the modules
        const qualifiedCallbacks = mod.callbacks.filter(({ deps }) =>
            deps.includes(acceptedPath),
        )

        console.log(`fetchUpdate`, update, { isSelfUpdate, qualifiedCallbacks, cbs: mod.callbacks })

        if (isSelfUpdate || qualifiedCallbacks.length > 0) {
            const disposer = this.disposeMap.get(acceptedPath)
            if (disposer) await disposer(this.dataMap.get(acceptedPath))
            try {
                fetchedModule = await this.importUpdatedModule(update)
            } catch (e: any) {
                this.warnFailedUpdate(e, acceptedPath)
            }
        }

        return () => {
            for (const { deps, fn } of qualifiedCallbacks) {
                fn(
                    deps.map((dep) => (dep === acceptedPath ? fetchedModule : undefined)),
                )
            }
            const loggedPath = isSelfUpdate ? path : `${acceptedPath} via ${path}`
            this.logger.debug(`hot updated: ${loggedPath}`)
        }
    }

    public async update(e: { url: string, version: number, timestamp: number, importer: string }[]) {
        const result = this.testEvent(e)
        if (result) {
            await this.queueUpdate(result)
        }
        return result
    }

    public testEvent(e: { url: string, version: number, timestamp: number, importer: string }[]) {
        const updates = e.map(e => ({ path: e.importer, acceptedPath: e.url, version: e.version, timestamp: e.timestamp }))

        for (const update of updates) {
            const res = this.testUpdate(update)
            if (res?.qualifiedCallbacks.length) {
                return res
            }
            const res2 = this.testUpdate({
                path: update.acceptedPath,
                acceptedPath: update.acceptedPath,
                version: update.version,
                timestamp: update.timestamp
            })
            if (res2?.qualifiedCallbacks.length) {
                return res2
            }
        }

    }

    public testUpdate(update: HotUpdate) {
        const { path, acceptedPath, version, timestamp } = update
        const mod = this.hotModulesMap.get(path)
        if (!mod) {
            return
        }
        const isSelfUpdate = path === acceptedPath
        const qualifiedCallbacks = mod.callbacks.filter(({ deps }) => deps.includes(acceptedPath))

        const result = {
            path,
            version,
            timestamp,
            acceptedPath,
            isSelfUpdate,
            qualifiedCallbacks,
        }

        // console.log(`testUpdate`, result)

        return result
    }
}
