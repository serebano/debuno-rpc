import * as b from './b.ts'
export { add } from './a.ts'

export const stream: typeof b.stream = b.stream

export function sayHi(name: string): string {
    return `Hello, ${name}!!!`;
}

export function sayBye(x: string): string {
    return `Goodbye, ${x}!`;
}

export async function foo(...args: any[]): Promise<any[]> {
    return await Promise.resolve(args);
}

export const bar = (a: number, b: number): number => a + b

export function objFunc(obj: { a: number, b: number }): number {
    return obj.a + obj.b;
}

function localFunc(): string { return 'blah' }
export const exportedLocal: typeof localFunc = localFunc;

export const xxx = function c({ a, b, x: [z], ...u }: { a: number, b: number, x: [z: number], u: any }) {
    return a + b + z + Object.values(u).reduce((acc, v) => acc + v, 0);
}

export const yyy = ([a, b, { x }]: [number, number, { x: number }]) => a + b + x;

export const zzz = (x = 200, y = { x }): number => x + 2

export default {
    foo(name: string): string {
        return name
    },
    bar: (a: number, b: number): number => a + b
}

export const test = {
    foo(name: string): string {
        return name
    },
    bar: (a: number, b: number) => { return a + b }
}

export class MyClass {
    static staticMethod(val: number): string {
        return String(val);
    }
}

export const arr = [
    (a: number): number => a + 1,
    (b: number): number => b + 2,
]

export {
    foo as f,
    bar as b,
}

export const acc = {
    _val: 0,
    get val(): number {
        return this._val;
    },
    set val(v: number) {
        this._val = v;
    }
}