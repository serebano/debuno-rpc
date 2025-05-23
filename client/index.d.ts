// deno-lint-ignore-file no-explicit-any
// This file is an augmentation to the built-in ImportMeta interface
// Thus cannot contain any top-level imports

// <https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation>
type InferCustomEventPayload<T> = any
type ModuleNamespace = Record<string, any>

interface ImportMetaEnv {
    [key: string]: any
    DEV: boolean
    PATH: string
    PORT: number
    BASE: string
    ORIGIN: string
    BASE_URL: string
    ENDPOINT: string
    RUNTIME: string
    RPC_DIR: string
}

interface ImportMeta {
    url: string
    readonly hot?: import('./hot.ts').HotContext
    readonly rpc: import('./rpc.ts').RPCContext
    readonly env: ImportMetaEnv
}

interface Console {
    create(namespace: string, options?: import('../utils/console.ts').CreateConsoleOptions): import("../utils/console.ts").XConsole
    extend(namespace: string, options?: import('../utils/console.ts').CreateConsoleOptions): import("../utils/console.ts").XConsole
}