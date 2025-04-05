export interface ConfigInitMap {
    [key: string]: ConfigInit[]
}
export interface ConfigInit {
    dev?: boolean
    server: {
        readonly $id: string;
        url: URL;
        path: string;
        port: number;
        base: string;
        host: string;
        hostname: string;
        protocol: string;
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
        readonly $id: string;
        url: URL;
        path: string;
        port: number;
        base: string;
        host: string;
        hostname: string;
        protocol: string;
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
    readonly rpcDir: string;
    readonly genDir: string;
    getEnv(url: string | URL | Location): ImportMetaEnv;
    filter: (file: string) => boolean;
}