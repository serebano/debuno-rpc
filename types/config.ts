export interface ConfigInitMap {
    [key: string]: ConfigInit[]
}
export interface ConfigInit {
    $id: string,
    $uid: string,
    $file?: string,
    dev?: boolean
    server: {
        readonly $id: string;
        readonly $addr: string;
        readonly $file?: string,
        endpoint: string;
        url: URL;
        dirname: string;
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
    readonly $id: string
    readonly $uid: string
    readonly $file?: string
    readonly dev: boolean
    readonly runtime: string
    readonly rpcModDir: string
    readonly server: ConfigInit['server'];
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
    inspector(dev?: boolean): Promise<{
        scheme: string;
        url: string;
    }>
    getEnv(url: string | URL | Location): ImportMetaEnv;
    filter: (file: string) => boolean;
}