# @debuno/rpc

```ts
// ./api/foo.ts
export const sayHi = (name: string) => `Hello ${name}!`;
```

```ts
// debuno [deno/bun/node] ./server.ts

import { serve } from "@debuno/rpc/serve";

await serve({
  port: 8077,
  path: "./api",
});
```

```ts
// debuno [deno/bun/node] ./client.ts

import { sayHi } from "http://localhost:8077/foo.ts";

console.log(await sayHi("World"));
```
