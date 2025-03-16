type Deps = Record<string, Record<string, number | null>>

export const versions = {} as Record<string, number>;
export const timestamps = {} as Record<string, number>;
export const dependents = {} as Deps
export const dependencies = {} as Deps

export interface Dependent { url: string, importer: string, version: number, timestamp: number }

export function getDependents(url: string, updateVersion: boolean = false): Dependent[] {
    function _getDependents(url: string, version: number, timestamp: number, arr: Dependent[] = []) {
        versions[url] = version
        for (const importer of Object.keys(dependents[url] || {})) {
            arr.push({ url, importer, version, timestamp })
            const v = updateVersion ? (versions[importer] || 0) + 1 : versions[importer]
            _getDependents(importer, v, timestamp, arr)
        }
        return arr
    }

    return _getDependents(url, versions[url], timestamps[url])
}