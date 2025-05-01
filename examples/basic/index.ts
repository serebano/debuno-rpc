import getEnv, { getCwd } from "./app.ts"

document.body.innerHTML = `
<h1>Welcome!</h1>
<pre>${JSON.stringify(import.meta.env, null, 4)}</pre>
<h3>${await getCwd()}</h3>
<pre>${JSON.stringify(await getEnv(), null, 4)}</pre>

`

console.log(import.meta.env)

if (import.meta.hot) {
    import.meta.hot.accept()
}