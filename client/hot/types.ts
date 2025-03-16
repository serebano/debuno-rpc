export type CustomListenersMap = Map<string, ((data: any) => void)[]>

// export interface HotUpdate {
//     path: string
//     version: number
//     acceptedPath: string
// }

export interface Update {
    // The type of update
    type: 'js-update' | 'css-update'
    // The URL path of the accepted module (HMR boundary root)
    path: string
    // The URL path that is accepted (usually the same as above)
    // (We'll talk about this later)
    acceptedPath: string
    // The timestamp when the update happened
    timestamp: number
}

export interface HotUpdate {
    // type: 'js-update' | 'css-update'
    path: string
    acceptedPath: string
    timestamp: number
    version?: number
    /** @internal */
    explicitImportRequired?: boolean
    /** @internal */
    isWithinCircularImport?: boolean
    /** @internal */
    invalidates?: string[]
}

export interface HotModule {
    id: string
    callbacks: HotCallback[]
}

export interface HotCallback {
    // the dependencies must be fetchable paths
    deps: string[]
    fn: (modules: Array<ModuleNamespace | undefined>) => void
}

export interface HMRLogger {
    error(msg: string | Error): void
    debug(...msg: unknown[]): void
}


export type HotContext = {
    // readonly url: URL;
    readonly module: HotModule | undefined;
    readonly version: number | undefined;

    readonly ownerPath: string
    readonly data: any

    accept(): void
    accept(cb: (mod: ModuleNamespace | undefined, ver: number | undefined) => void): void
    accept(dep: string, cb: (mod: ModuleNamespace | undefined) => void): void
    accept(
        deps: readonly string[],
        cb: (mods: Array<ModuleNamespace | undefined>) => void,
    ): void

    acceptExports(
        exportNames: string | readonly string[],
        cb?: (mod: ModuleNamespace | undefined) => void,
    ): void

    dispose(cb: (data: any) => void): void
    prune(cb: (data: any) => void): void
    invalidate(message?: string): void
}