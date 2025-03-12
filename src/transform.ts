import { parseSync, type OxcError } from 'npm:oxc-parser@0.51.0';
import type * as oxc from 'npm:@oxc-project/types@0.51.0';

type Id = oxc.BindingIdentifier | oxc.BindingPattern | oxc.PropertyKey | { index: number } | null

export async function transform(fileName: string, code: string, options?: {
    format?: 'javascript' | 'typescript'
    fileName?: string
    sourceMap?: boolean
    callImportName?: string
    callImportUrl?: string

}): Promise<{ errors: OxcError[]; code: string; source: { code: string, map?: any } }> {

    const CALL_IMPORT_NAME = options?.callImportName || '$call'
    const CALL_IMPORT_URL = options?.callImportUrl || `data:text/javascript;base64,${btoa('export default ' + (await import('./call.ts')).default + `\n//# sourceURL=/call.js`)}`

    // const CALL_IMPORT_DECL = `import ${CALL_IMPORT_NAME} from '${CALL_IMPORT_URL}'\n`
    const RPC_CREATE = `import.meta.rpc = (await import('${CALL_IMPORT_URL}')).create(import.meta.url) }\n`
    const RPC_CALL = (...args: any[]) => `import.meta.rpc(${args.join(', ')})`

    console.log(`transform > ${fileName} (${options?.format})`)

    let source = { code }
    if (options?.format === 'javascript') {
        const oxcTransform = await import('npm:oxc-transform@0.51.0');
        const transformed = oxcTransform.transform(fileName, code, {
            sourcemap: options.sourceMap
        });
        source = transformed
        code = transformed.code
    }

    const { errors, program, magicString } = parseSync(fileName, code);

    function createCallExpression(
        path: Id[],
        params: oxc.ParamPattern[]
    ): string {
        // @ts-ignore ???
        const name = path.filter(Boolean).map(p => p.name || p.index).join('.')
        const args = params.map(p => {
            if (p.type === 'AssignmentPattern')
                p = p.left as oxc.ParamPattern

            if (options?.format === 'javascript' && p.typeAnnotation) {
                magicString.remove(p.typeAnnotation.start, p.typeAnnotation.end)
            }

            return p.typeAnnotation
                ? magicString.getSourceText(p.start, p.typeAnnotation.start).trim()
                : magicString.getSourceText(p.start, p.end).trim()
        }).map(arg => arg.endsWith('?') ? arg.slice(0, -1) : arg)

        return RPC_CALL(`"${name}"`, ...args);
    }

    function transformFunc({ path, params, body, returnType }: {
        path: Id[];
        params: oxc.ParamPattern[];
        body: oxc.Expression | oxc.FunctionBody | null;
        returnType?: oxc.TSTypeAnnotation | null;
    }): void {

        if (!body) return;

        if (returnType)
            transformReturnType(returnType)

        magicString.remove(body.start, body.end)

        const callExp = createCallExpression(path, params);

        const returns = (body.type === 'BlockStatement' && !!body.body.find(b => b.type === 'ReturnStatement'))
        const returnExp = returns ? 'return ' : ''

        if (body.type === 'BlockStatement') {
            magicString.prependRight(body.start, `{ ${returnExp}${callExp} }`);
        } else {
            magicString.prependRight(body.start, callExp);
        }
    }

    function transformReturnType(returnType: oxc.TSTypeAnnotation) {

        const returnTypeText = magicString.getSourceText(returnType.start, returnType.end).slice(1).trim()
        const promiseReturnType = returnTypeText.startsWith('Promise') ? returnTypeText : `Promise<${returnTypeText}>`

        magicString.remove(returnType.start, returnType.end)
        if (options?.format === 'javascript')
            return
        magicString.prependRight(returnType.start, `: ${promiseReturnType}`)
    }

    for (const node of (program as oxc.Program).body) {

        if (
            node.type === 'ExportNamedDeclaration' ||
            node.type === 'ExportDefaultDeclaration'
        ) {
            if (!node.declaration) continue;

            if (
                node.declaration.type === 'FunctionDeclaration' ||
                node.declaration.type === 'FunctionExpression' ||
                node.declaration.type === 'ArrowFunctionExpression'
            ) {
                const { id, params, body, returnType } = node.declaration;
                const path = [
                    node.type === 'ExportDefaultDeclaration' ? { name: 'default' } : null,
                    id
                ] as Id[];

                transformFunc({ path, params, body, returnType })

            } else if (
                node.declaration.type === 'VariableDeclaration'
            ) {
                const decls = node.declaration.declarations;

                for (const decl of decls) {
                    if (!decl.init) continue;

                    if ((
                        decl.init.type === 'ArrowFunctionExpression' ||
                        decl.init.type === 'FunctionExpression'
                    )) {
                        const id = decl.id;
                        const { params, body, returnType } = decl.init;

                        transformFunc({ path: [id], params, body, returnType })

                    } else if (
                        decl.init.type === 'ObjectExpression'
                    ) {
                        for (const prop of decl.init.properties) {
                            if (prop.type === 'Property' && (
                                prop.value.type === 'FunctionExpression' ||
                                prop.value.type === 'ArrowFunctionExpression')
                            ) {

                                const { params, body, returnType } = prop.value;

                                transformFunc({ path: [decl.id, prop.key], params, body, returnType })
                            }
                        }
                    } else if (
                        decl.init.type === 'ClassExpression'
                    ) {
                        const { id, body } = decl.init;

                        for (const method of body.body) {
                            if (method.type === 'MethodDefinition' && (
                                method.value.type === 'FunctionExpression' ||
                                method.value.type === 'FunctionDeclaration')
                            ) {
                                const { key, value } = method;
                                const { params, body, returnType } = value;

                                transformFunc({ path: [id, key], params, body, returnType })
                            }
                        }
                    } else if (
                        decl.init.type === 'ArrayExpression'
                    ) {
                        for (const elem of decl.init.elements) {
                            if (!elem) continue;
                            if (
                                elem.type === 'FunctionExpression' ||
                                elem.type === 'ArrowFunctionExpression'
                            ) {
                                const { params, body, returnType } = elem;
                                const index = decl.init.elements.indexOf(elem);

                                transformFunc({ path: [decl.id, { index }], params, body, returnType })
                            }
                        }
                    }
                }
            } else if (
                node.declaration.type === 'ObjectExpression'
            ) {
                for (const prop of node.declaration.properties) {
                    if (prop.type === 'Property' && (
                        prop.value.type === 'FunctionExpression' ||
                        prop.value.type === 'ArrowFunctionExpression')
                    ) {

                        const { params, body, returnType } = prop.value;
                        const path = [
                            node.type === 'ExportDefaultDeclaration' ? { name: 'default' } : null,
                            prop.key
                        ] as Id[];

                        transformFunc({ path, params, body, returnType })
                    }
                }
            } else if (
                node.declaration.type === 'ClassDeclaration'
            ) {
                const { id, body } = node.declaration;
                for (const method of body.body) {
                    if (method.type === 'MethodDefinition' && (
                        method.value.type === 'FunctionExpression' ||
                        method.value.type === 'FunctionDeclaration')
                    ) {
                        const { key, value } = method;
                        const { params, body, returnType } = value;
                        const path = [
                            node.type === 'ExportDefaultDeclaration' ? { name: 'default' } : null,
                            id,
                            key
                        ] as Id[];

                        transformFunc({ path, params, body, returnType })
                    }
                }
            } else if (
                node.declaration.type === 'ArrayExpression'
            ) {

                for (const elem of node.declaration.elements) {
                    if (!elem) continue;
                    if (
                        elem.type === 'FunctionExpression' ||
                        elem.type === 'ArrowFunctionExpression'
                    ) {
                        const { params, body, returnType } = elem;
                        const path = [
                            node.type === 'ExportDefaultDeclaration' ? { name: 'default' } : null,
                            { index: node.declaration.elements.indexOf(elem) }
                        ] as Id[];

                        transformFunc({ path, params, body, returnType })
                    }
                }
            }
        }
    }

    if (magicString.hasChanged())
        magicString.prepend(RPC_CREATE)

    if (options?.sourceMap === true) {
        const sourceMappingURL = magicString.generateMap({
            source: options.fileName || fileName,
            includeContent: true,
            hires: false,
        }).toUrl()

        magicString.append(`\n//# sourceMappingURL=${sourceMappingURL}`)
    }

    return {
        errors,
        source,
        code: magicString.toString()
    }
}