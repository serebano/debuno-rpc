import process from "node:process";

export function getCliArgs() {
    const path = (process.argv.slice(2)[0]?.split(':')[0] || '.')
    const port = parseInt(process.argv.slice(2)[0]?.split(':')[1] || '8080')
    const base = (process.argv.slice(2)[0]?.split(':')[2] || '/')

    return { path, port, base }
}
