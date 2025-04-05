import { cyan, magenta, red, yellow } from "jsr:@std/fmt@~1.0.2/colors";

export type ConsoleLevel = 'info' | 'error' | 'warn'


export function createConsole(name: string, opts: { levels?: ConsoleLevel[] } = {}) {
    const { levels = [] } = opts;

    return {
        info(...args: any[]) {
            if (!levels.includes('info') || !args.length) return;
            console.log(cyan(`${name}`), ...args);
        },
        error(...args: any[]) {
            if (!levels.includes('error') || !args.length) return;
            console.error(red(`${name}`), ...args);
        },
        warn(...args: any[]) {
            if (!levels.includes('warn') || !args.length) return;
            console.warn(yellow(`${name}`), ...args);
        },
        log(...args: any[]) {
            if (!levels.includes('info') || !args.length) return;
            console.log(cyan(`${name}`), ...args);
        },
        group(...args: any[]) {
            if (!levels.length) return;
            args.length
                ? console.group(magenta(`${name}`), ...args)
                : console.group();
        },
        groupEnd() {
            if (!levels.length) return;
            console.groupEnd();
        },
        groupCollapsed(...args: any[]) {
            if (!levels.length) return;
            args.length
                ? console.groupCollapsed(magenta(`${name}`), ...args)
                : console.groupCollapsed();
        },
        groupCollapsedEnd() {
            if (!levels.length) return;
            console.groupEnd();
        }
    }
}