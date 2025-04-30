import type { RPCServer } from "../server/serve.ts";
import type { SSE } from "../server/sse/types.ts";
import type { App, AppState } from "./app.ts";
import type { Env } from "./env.ts";

export interface Context {
    sse: SSE
    env: Env
    server?: RPCServer
    endpoints: string[]
    get files(): import("../server/sse/types.ts").File[]
    get importMap(): Record<string, string>
    get importMapFile(): string

    getFiles(force?: boolean): Promise<import("../server/sse/types.ts").File[]>
    getImportMap(force?: boolean): Promise<Record<string, string>>
    watchRemoteImport(endpoint: string, importUrl: string, importerUrl: string): void
    get apps(): App[]
    get state(): AppState
    start(): Promise<App>
    stop(): Promise<App>
    restart(): Promise<App>

    get remotes(): {
        watchers: Map<string, EventSource>;
        endpoints: Map<string, Set<string>>;
        importers: Map<string, Set<string>>;
        imports: Map<string, Set<string>>;
        unwatchImport: (remoteImport: string) => void
    }
}