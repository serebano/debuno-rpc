import * as colors from "jsr:@std/fmt@~1.0.2/colors";

export type ConsoleColor = 'gray' | 'red' | 'yellow' | 'blue' | 'green' | 'magenta' | 'cyan'
export type ConsoleLevel = 'info' | 'error' | 'warn' | 'debug'
export type ConsoleLevels = {
    debug: ["debug", "info", "warn", "error"];
    info: ["info", "warn", "error"];
    warn: ["warn", "error"];
    error: ["error"];
}

export const levelsMap: ConsoleLevels = {
    debug: ['debug', 'info', 'warn', 'error'],
    info: ['info', 'warn', 'error'],
    warn: ['warn', 'error'],
    error: ['error']
}

function getLevels<L extends ConsoleLevel>(level: L): ConsoleLevels[L] {
    return levelsMap[level] as ConsoleLevels[L]
}

export function createConsole(
    name: string | null,
    opts: {
        colors?: {
            info?: ConsoleColor,
            error?: ConsoleColor,
            warn?: ConsoleColor,
            debug?: ConsoleColor,
            group?: ConsoleColor,
        },
        level?: ConsoleLevel,
        levels?: ConsoleLevel[]
    } = {}
): { level: ConsoleLevel | undefined; levels: ConsoleLevel[]; name: string | null; colors: { info?: ConsoleColor; error?: ConsoleColor; warn?: ConsoleColor; debug?: ConsoleColor; group?: ConsoleColor; }; debug(...args: any[]): void; info(...args: any[]): void; error(...args: any[]): void; warn(...args: any[]): void; log(...args: any[]): void; group(...args: any[]): void; groupEnd(): void; groupCollapsed(...args: any[]): void; groupCollapsedEnd(): void; } {

    opts.levels = opts.level ? getLevels(opts.level) : opts.levels || []
    opts.colors = Object.assign({
        info: 'gray',
        error: 'red',
        warn: 'yellow',
        debug: 'blue',
        group: 'cyan',
    }, opts.colors);

    const levelColors = {
        info: (s: any) => typeof s === 'string' ? colors[opts.colors?.info || 'gray'](s) : s,
        error: (s: any) => typeof s === 'string' ? colors[opts.colors?.error || 'red'](s) : s,
        warn: (s: any) => typeof s === 'string' ? colors[opts.colors?.warn || 'yellow'](s) : s,
        debug: (s: any) => typeof s === 'string' ? colors[opts.colors?.debug || 'blue'](s) : s,
        group: (s: any) => typeof s === 'string' ? colors[opts.colors?.group || 'cyan'](s) : s,
    };
    const levels = opts.levels
    return {
        level: opts.level,
        levels,
        name,
        colors: opts.colors,
        debug(...args: any[]) {
            if (!levels.includes('debug') || !args.length) return;
            console.debug(...args.map(levelColors.debug));
        },
        info(...args: any[]) {
            if (!levels.includes('info') || !args.length) return;
            console.info(...args.map(levelColors.info));
        },
        error(...args: any[]) {
            if (!levels.includes('error') || !args.length) return;
            console.error(...args.map(levelColors.error));
        },
        warn(...args: any[]) {
            if (!levels.includes('warn') || !args.length) return;
            console.warn(...args.map(levelColors.warn));
        },
        log(...args: any[]) {
            if (!levels.includes('info') || !args.length) return;
            console.log(...args);
        },
        group(...args: any[]) {
            if (!levels.length) return;
            args.length
                ? console.group(...args.map(levelColors.group))
                : console.group();
        },
        groupEnd() {
            if (!levels.length) return;
            console.groupEnd();
        },
        groupCollapsed(...args: any[]) {
            if (!levels.length) return;
            args.length
                ? console.groupCollapsed(...args.map(levelColors.group))
                : console.groupCollapsed();
        },
        groupCollapsedEnd() {
            if (!levels.length) return;
            console.groupEnd();
        }
    }
}