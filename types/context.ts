import type { RPCServer } from "./server.ts";
import type { SSE } from "../server/sse/types.ts";
import type { RPCApp, AppState } from "./app.ts";
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
    get apps(): RPCApp[]
    get state(): AppState
    start(): Promise<RPCApp>
    stop(): Promise<RPCApp>
    restart(): Promise<RPCApp>

    get remotes(): {
        watchers: Map<string, EventSource>;
        endpoints: Map<string, Set<string>>;
        importers: Map<string, Set<string>>;
        imports: Map<string, Set<string>>;
        appImports: Set<string> | undefined;
        unwatchImport: (remoteImport: string) => void
    }
}