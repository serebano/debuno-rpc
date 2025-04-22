
export interface Meta {
    versions: Record<string, number>
    timestamps: Record<string, number>
    dependents: Deps
    dependencies: Deps
}

export interface ModuleMeta {
    version: number;
    timestamp: number;
    dependents: Record<string, number | null>;
    dependencies: Record<string, number | null>;
}


type Deps = Record<string, Record<string, number | null>>
export interface Dependent { url: string, importer: string, version: number, timestamp: number }

export const versions = {} as Record<string, number>;
export const timestamps = {} as Record<string, number>;
export const dependencies = {} as Deps
export const dependents = {} as Deps

export function getDependents(url: string, updateVersion: boolean = false): Dependent[] {
    function _getDependents(
        url: string,
        version: number,
        timestamp: number,
        arr: Dependent[] = [],
        visited = new Set<string>()
    ): Dependent[] {
        if (visited.has(url)) return arr;
        visited.add(url);

        versions[url] = version;

        for (const importer of Object.keys(dependents[url] || {})) {
            arr.push({ url, importer, version, timestamp });

            const v = updateVersion ? (versions[importer] || 0) + 1 : (versions[importer] ?? version);
            _getDependents(importer, v, timestamp, arr, visited);
        }

        return arr;
    }

    return _getDependents(url, versions[url] ?? 0, timestamps[url] ?? Date.now());
}

// export function getDependents(url: string, updateVersion: boolean = false): Dependent[] {
//     function _getDependents(url: string, version: number, timestamp: number, arr: Dependent[] = []) {
//         versions[url] = version
//         for (const importer of Object.keys(dependents[url] || {})) {
//             arr.push({ url, importer, version, timestamp })
//             const v = updateVersion ? (versions[importer] || 0) + 1 : versions[importer]
//             _getDependents(importer, v, timestamp, arr)
//         }
//         return arr
//     }

//     return _getDependents(url, versions[url], timestamps[url])
// }

const meta = {
    rm,
    get,
    getDependents,
    incVersion,
    versions,
    timestamps,
    dependents,
    dependencies
} as Meta & {
    rm(url: string): void
    get(): Meta
    get(url: string): ModuleMeta
    incVersion: (id: string) => void
    getDependents: (url: string, updateVersion?: boolean) => Dependent[]
}
export default meta
export function get(): Meta
export function get(url: string): ModuleMeta
export function get(url?: string): Meta | ModuleMeta {
    return url ? {
        version: meta.versions[url],
        timestamp: meta.timestamps[url],
        dependents: meta.dependents[url],
        dependencies: meta.dependencies[url]
    } : meta
}

export function rm(url: string): void {
    delete meta.versions[url];
    delete meta.timestamps[url];
    delete meta.dependents[url];
    delete meta.dependencies[url];

    for (const key of Object.keys(meta.dependents)) {
        const obj = meta.dependents[key]
        delete obj[url]
    }

    for (const key of Object.keys(meta.dependencies)) {
        const obj = meta.dependencies[key]
        delete obj[url]
    }
}

export function incVersion(id: string) {
    versions[id] = versions[id] || 0;
    versions[id]++;

    timestamps[id] = Date.now()

    for (const key of Object.keys(dependents)) {
        if (id in dependents[key]) {
            dependents[key][id] = versions[id];
        }
    }

    for (const key of Object.keys(dependencies)) {
        if (id in dependencies[key]) {
            dependencies[key][id] = versions[id];
        }
    }
}

