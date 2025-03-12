#!/usr/bin/env deno -A --watch -r=http://localhost:8000/x.ts -r=http://localhost:8000/b.ts -r=http://localhost:8000/a.ts -r=http://localhost:8000/y.ts -r=http://localhost:8000/.call.ts

import * as demo from 'http://localhost:8000/y.ts';
import { add } from 'http://localhost:8000/sub/a1.ts'

console.log(demo);
// console.log(await demo.sayHi('World!'));
// console.log(await demo.foo(1, [34, 5], 'hello'));

; (await demo.stream())
    .pipeThrough(new TextDecoderStream)
    .pipeTo(new WritableStream({
        write(c) {
            console.log(c)
        }
    }))

demo.acc.val = await demo.acc.val + 1

console.log(await demo.acc.val)
console.log(await add(10, await demo.acc.val))
// console.log(await demo.add(await demo.acc.val, 2));
