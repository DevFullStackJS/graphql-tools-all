import { isSchema, parse, buildClientSchema, Kind, print } from 'graphql';
import { isValidPath, parseGraphQLSDL, debugLog, asArray, printSchemaWithDirectives } from '@graphql-tools/utils';
import { gqlPluckFromCodeString, gqlPluckFromCodeStringSync } from '@graphql-tools/graphql-tag-pluck';
import { isAbsolute, resolve } from 'path';
import { cwd } from 'process';
import { accessSync, readFileSync, promises } from 'fs';

/**
 * @internal
 */
function pick(obj, keys) {
    for (const key of keys) {
        if (obj[key]) {
            return obj[key];
        }
    }
    return obj;
}
// checkers
/**
 * @internal
 */
function isSchemaText(obj) {
    return typeof obj === 'string';
}
/**
 * @internal
 */
function isWrappedSchemaJson(obj) {
    const json = obj;
    return json.data !== undefined && json.data.__schema !== undefined;
}
/**
 * @internal
 */
function isSchemaJson(obj) {
    const json = obj;
    return json !== undefined && json.__schema !== undefined;
}
/**
 * @internal
 */
function isSchemaAst(obj) {
    return obj.kind !== undefined;
}

const identifiersToLookFor = ['default', 'schema', 'typeDefs', 'data'];
// Pick exports
/**
 * @internal
 */
function pickExportFromModule({ module, filepath }) {
    ensureModule({ module, filepath });
    return resolveModule(ensureExports({ module, filepath }));
}
/**
 * @internal
 */
function pickExportFromModuleSync({ module, filepath }) {
    ensureModule({ module, filepath });
    return resolveModuleSync(ensureExports({ module, filepath }));
}
// module
async function resolveModule(identifiers) {
    const exportValue = await pick(await identifiers, identifiersToLookFor);
    return resolveExport(exportValue);
}
function resolveModuleSync(identifiers) {
    const exportValue = pick(identifiers, identifiersToLookFor);
    return resolveExport(exportValue);
}
// validate
function ensureModule({ module, filepath }) {
    if (!module) {
        throw new Error(`Invalid export from export file ${filepath}: empty export!`);
    }
}
function ensureExports({ module, filepath }) {
    const identifiers = pick(module, identifiersToLookFor);
    if (!identifiers) {
        throw new Error(`Invalid export from export file ${filepath}: missing default export or 'schema' export!`);
    }
    return identifiers;
}
// Decide what to do with an exported value
function resolveExport(fileExport) {
    try {
        if (isSchema(fileExport)) {
            return fileExport;
        }
        if (isSchemaText(fileExport)) {
            return parse(fileExport);
        }
        if (isWrappedSchemaJson(fileExport)) {
            return buildClientSchema(fileExport.data);
        }
        if (isSchemaJson(fileExport)) {
            return buildClientSchema(fileExport);
        }
        if (isSchemaAst(fileExport)) {
            return fileExport;
        }
        return null;
    }
    catch (e) {
        throw new Error('Exported schema must be of type GraphQLSchema, text, AST, or introspection JSON.');
    }
}

/**
 * @internal
 */
async function tryToLoadFromExport(rawFilePath) {
    try {
        const filepath = ensureFilepath(rawFilePath);
        const mod = await import(filepath);
        return await pickExportFromModule({ module: mod, filepath });
    }
    catch (e) {
        throw new Error(`Unable to load from file "${rawFilePath}": ${e.message}`);
    }
}
/**
 * @internal
 */
function tryToLoadFromExportSync(rawFilePath) {
    try {
        const filepath = ensureFilepath(rawFilePath);
        const mod = require(filepath);
        return pickExportFromModuleSync({ module: mod, filepath });
    }
    catch (e) {
        throw new Error(`Unable to load from file "${rawFilePath}": ${e.message}`);
    }
}
/**
 * @internal
 */
function ensureFilepath(filepath) {
    if (typeof require !== 'undefined' && require.cache) {
        filepath = require.resolve(filepath);
        if (require.cache[filepath]) {
            delete require.cache[filepath];
        }
    }
    return filepath;
}

const { readFile, access } = promises;
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue'];
/**
 * This loader loads GraphQL documents and type definitions from code files
 * using `graphql-tag-pluck`.
 *
 * ```js
 * const documents = await loadDocuments('queries/*.js', {
 *   loaders: [
 *     new CodeFileLoader()
 *   ]
 * });
 * ```
 *
 * Supported extensions include: `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`
 */
class CodeFileLoader {
    loaderId() {
        return 'code-file';
    }
    async canLoad(pointer, options) {
        if (isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
                try {
                    await access(normalizedFilePath);
                    return true;
                }
                catch (_a) {
                    return false;
                }
            }
        }
        return false;
    }
    canLoadSync(pointer, options) {
        if (isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
                try {
                    accessSync(normalizedFilePath);
                    return true;
                }
                catch (_a) {
                    return false;
                }
            }
        }
        return false;
    }
    async load(pointer, options) {
        const normalizedFilePath = ensureAbsolutePath(pointer, options);
        const errors = [];
        if (!options.noPluck) {
            try {
                const content = await readFile(normalizedFilePath, { encoding: 'utf-8' });
                const sdl = await gqlPluckFromCodeString(normalizedFilePath, content, options.pluckConfig);
                if (sdl) {
                    return parseSDL({ pointer, sdl, options });
                }
            }
            catch (e) {
                debugLog(`Failed to load schema from code file "${normalizedFilePath}": ${e.message}`);
                errors.push(e);
            }
        }
        if (!options.noRequire) {
            try {
                if (options && options.require) {
                    await Promise.all(asArray(options.require).map(m => import(m)));
                }
                const loaded = await tryToLoadFromExport(normalizedFilePath);
                const source = resolveSource(pointer, loaded, options);
                if (source) {
                    return source;
                }
            }
            catch (e) {
                errors.push(e);
            }
        }
        if (errors.length > 0) {
            throw errors[0];
        }
        return null;
    }
    loadSync(pointer, options) {
        const normalizedFilePath = ensureAbsolutePath(pointer, options);
        const errors = [];
        if (!options.noPluck) {
            try {
                const content = readFileSync(normalizedFilePath, { encoding: 'utf-8' });
                const sdl = gqlPluckFromCodeStringSync(normalizedFilePath, content, options.pluckConfig);
                if (sdl) {
                    return parseSDL({ pointer, sdl, options });
                }
            }
            catch (e) {
                debugLog(`Failed to load schema from code file "${normalizedFilePath}": ${e.message}`);
                errors.push(e);
            }
        }
        if (!options.noRequire) {
            try {
                if (options && options.require) {
                    asArray(options.require).forEach(m => require(m));
                }
                const loaded = tryToLoadFromExportSync(normalizedFilePath);
                const source = resolveSource(pointer, loaded, options);
                if (source) {
                    return source;
                }
            }
            catch (e) {
                errors.push(e);
            }
        }
        if (errors.length > 0) {
            throw errors[0];
        }
        return null;
    }
}
function parseSDL({ pointer, sdl, options }) {
    return parseGraphQLSDL(pointer, sdl, options);
}
function resolveSource(pointer, value, options) {
    if (isSchema(value)) {
        return {
            location: pointer,
            rawSDL: printSchemaWithDirectives(value, options),
            schema: value,
        };
    }
    else if ((value === null || value === void 0 ? void 0 : value.kind) === Kind.DOCUMENT) {
        return {
            location: pointer,
            rawSDL: print(value),
            document: value,
        };
    }
    else if (typeof value === 'string') {
        return parseGraphQLSDL(pointer, value, options);
    }
    return null;
}
function ensureAbsolutePath(pointer, options) {
    return isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
}

export { CodeFileLoader };
//# sourceMappingURL=index.esm.js.map
