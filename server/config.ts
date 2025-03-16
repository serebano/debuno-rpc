// deno-lint-ignore-file no-process-global

export default {
    srcKey: 'src' as const,
    genKey: 'gen' as const,
    get libRoot() {
        return import.meta.url.replace('file:///', '/').split('/').slice(0, -2).join('/')
    },
    get name() {
        return this.path.split('/').pop()
    },
    get protocol() {
        return `web+rpc`
    },
    get path() {
        return (process.argv.slice(2)[0]?.split(':')[0] || '.')
    },
    get port() {
        return parseInt(process.argv.slice(2)[0]?.split(':')[1] || '8080')
    },
    get base() {
        const base = process.argv.slice(2)[1] || '/'

        return base.endsWith('/') ? base : `${base}/`
    },
    route(file: string): string {
        return ['/', this.base, file].join('/').replace(/\/{2,}/g, "/")
    },
    specifier(file: string): string {
        return [this.base, file].join('/').replace(/\/{2,}/g, "/")
    },
    filter: (file: string): boolean =>
        !file.includes('node_modules') && (
            file.endsWith('.ts') ||
            file.endsWith('.json') ||
            file.endsWith('.js') ||
            file.endsWith('.html') ||
            file.endsWith('.css') ||
            file.endsWith('.txt') ||
            file.endsWith('.md') ||
            file.endsWith('.sh')
        )
}