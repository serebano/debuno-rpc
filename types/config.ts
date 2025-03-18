export interface ConfigInit {
    dev?: boolean
    server?: {
        path?: string
        port?: number
        base?: string
    }
    client?: {
        base?: string
    }
    shared?: {
        jsxImportUrl?: string
    }
}

export interface Config {
    readonly dev: boolean
    readonly server: {
        path: string;
        port: number;
        base: string;
    };
    readonly client: {
        base: string;
        path: string;
        readonly rpcImportUrl: string;
        readonly hotImportUrl: string;
        readonly envImportUrl: string;
    };
    readonly shared: {
        jsxImportUrl: string | undefined;
    };
    readonly deno: Record<string, any>;
    readonly protocol: string;
    readonly srcKey: string;
    readonly genKey: string;
    getEnv(url: string | URL | Location): ImportMetaEnv;
    filter: (file: string) => boolean;
}