export interface Env {
    version: [
        rpc: string,
        runtime: string
    ];
    get(key?: string): string | NodeJS.ProcessEnv | undefined;
    set(key: string, value: any): void;
}
