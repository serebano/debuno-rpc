import chokidar, { type FSWatcher } from "chokidar"

const console = globalThis.console.extend('config')

export function watchRC(rcFilePath: string, listener: (e: { type: 'added' | 'changed' | 'removed', path: string }) => void): FSWatcher {
    console.debug(rcFilePath)

    const watcher = chokidar.watch(rcFilePath, {
        persistent: true,
        ignoreInitial: true,
    });

    return watcher
        .on('add', () => listener({ type: 'added', path: rcFilePath }))
        .on('change', () => listener({ type: 'changed', path: rcFilePath }))
        .on('unlink', () => listener({ type: 'removed', path: rcFilePath }));
}