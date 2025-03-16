// deno-lint-ignore-file no-explicit-any
// This file is an augmentation to the built-in ImportMeta interface
// Thus cannot contain any top-level imports

// <https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation>
type InferCustomEventPayload<T> = any
type ModuleNamespace = Record<string, any>

interface ImportMetaEnv {
    [key: string]: any
    BASE_URL: string
    MODE: string
    DEV: boolean
    PROD: boolean
}

interface ImportMeta {
    url: string

    hot?: import('./hot.ts').HotContext
    rpc: import('./rpc.ts').RPCContext

    readonly env: ImportMetaEnv
}

interface RPCHotContext {
    readonly data: any

    accept(): void
    accept<T = ModuleNamespace>(cb: (mod: T | undefined, ver: number) => void): void
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

    on<T extends string>(
        event: T,
        cb: (payload: InferCustomEventPayload<T>) => void,
    ): void
    off<T extends string>(
        event: T,
        cb: (payload: InferCustomEventPayload<T>) => void,
    ): void
}