'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

function _interopNamespace(e) {
    if (e && e.__esModule) { return e; } else {
        var n = {};
        if (e) {
            Object.keys(e).forEach(function (k) {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () {
                        return e[k];
                    }
                });
            });
        }
        n['default'] = e;
        return n;
    }
}

const globby = require('globby');
const globby__default = _interopDefault(globby);
const unixify = _interopDefault(require('unixify'));
const path = require('path');
const fs = require('fs');

const { readFile, stat } = fs.promises;
const DEFAULT_IGNORED_EXTENSIONS = ['spec', 'test', 'd', 'map'];
const DEFAULT_EXTENSIONS = ['gql', 'graphql', 'graphqls', 'ts', 'js'];
const DEFAULT_EXPORT_NAMES = ['typeDefs', 'schema'];
function asArray(obj) {
    if (obj instanceof Array) {
        return obj;
    }
    else {
        return [obj];
    }
}
function isDirectorySync(path) {
    try {
        const pathStat = fs.statSync(path);
        return pathStat.isDirectory();
    }
    catch (e) {
        return false;
    }
}
async function isDirectory(path) {
    try {
        const pathStat = await stat(path);
        return pathStat.isDirectory();
    }
    catch (e) {
        return false;
    }
}
function scanForFilesSync(globStr, globOptions = {}) {
    return globby.sync(globStr, { absolute: true, ...globOptions });
}
function buildGlob(basePath, extensions, ignoredExtensions = [], recursive) {
    const ignored = ignoredExtensions.length > 0 ? `!(${ignoredExtensions.map(e => '*.' + e).join('|')})` : '*';
    const ext = extensions.map(e => '*.' + e).join('|');
    return `${basePath}${recursive ? '/**' : ''}/${ignored}+(${ext})`;
}
function extractExports(fileExport, exportNames) {
    if (!fileExport) {
        return null;
    }
    if (fileExport.default) {
        for (const exportName of exportNames) {
            if (fileExport.default[exportName]) {
                return fileExport.default[exportName];
            }
        }
        return fileExport.default;
    }
    for (const exportName of exportNames) {
        if (fileExport[exportName]) {
            return fileExport[exportName];
        }
    }
    return fileExport;
}
const LoadFilesDefaultOptions = {
    ignoredExtensions: DEFAULT_IGNORED_EXTENSIONS,
    extensions: DEFAULT_EXTENSIONS,
    useRequire: false,
    requireMethod: null,
    globOptions: {
        absolute: true,
    },
    exportNames: DEFAULT_EXPORT_NAMES,
    recursive: true,
    ignoreIndex: false,
};
/**
 * Synchronously loads files using the provided glob pattern.
 * @param pattern Glob pattern or patterns to use when loading files
 * @param options Additional options
 */
function loadFilesSync(pattern, options = LoadFilesDefaultOptions) {
    const execOptions = { ...LoadFilesDefaultOptions, ...options };
    const relevantPaths = scanForFilesSync(asArray(pattern).map(path => isDirectorySync(path)
        ? buildGlob(unixify(path), execOptions.extensions, execOptions.ignoredExtensions, execOptions.recursive)
        : unixify(path)), options.globOptions);
    return relevantPaths
        .map(path$1 => {
        if (!checkExtension(path$1, options)) {
            return null;
        }
        if (isIndex(path$1, execOptions.extensions) && options.ignoreIndex) {
            return false;
        }
        const extension = path.extname(path$1);
        if (extension.endsWith('.js') || extension.endsWith('.ts') || execOptions.useRequire) {
            const fileExports = (execOptions.requireMethod ? execOptions.requireMethod : require)(path$1);
            const extractedExport = extractExports(fileExports, execOptions.exportNames);
            if (extractedExport.typeDefs && extractedExport.resolvers) {
                return extractedExport;
            }
            if (extractedExport.schema) {
                return extractedExport.schema;
            }
            if (extractedExport.typeDef) {
                return extractedExport.typeDef;
            }
            if (extractedExport.typeDefs) {
                return extractedExport.typeDefs;
            }
            if (extractedExport.resolver) {
                return extractedExport.resolver;
            }
            if (extractedExport.resolvers) {
                return extractedExport.resolvers;
            }
            return extractedExport;
        }
        else {
            return fs.readFileSync(path$1, { encoding: 'utf-8' });
        }
    })
        .filter(v => v);
}
async function scanForFiles(globStr, globOptions = {}) {
    return globby__default(globStr, { absolute: true, ...globOptions });
}
const checkExtension = (path, { extensions, ignoredExtensions }) => {
    if (ignoredExtensions) {
        for (const ignoredExtension of ignoredExtensions) {
            if (path.endsWith(ignoredExtension)) {
                return false;
            }
        }
    }
    if (!extensions) {
        return true;
    }
    for (const extension of extensions) {
        if (path.endsWith(extension)) {
            return true;
        }
    }
    return false;
};
/**
 * Asynchronously loads files using the provided glob pattern.
 * @param pattern Glob pattern or patterns to use when loading files
 * @param options Additional options
 */
async function loadFiles(pattern, options = LoadFilesDefaultOptions) {
    const execOptions = { ...LoadFilesDefaultOptions, ...options };
    const relevantPaths = await scanForFiles(await Promise.all(asArray(pattern).map(async (path) => (await isDirectory(path))
        ? buildGlob(unixify(path), execOptions.extensions, execOptions.ignoredExtensions, execOptions.recursive)
        : unixify(path))), options.globOptions);
    const require$ = (path) => new Promise(function (resolve) { resolve(_interopNamespace(require(path))); }).catch(async () => require(path));
    return Promise.all(relevantPaths
        .filter(path => checkExtension(path, options) && !(isIndex(path, execOptions.extensions) && options.ignoreIndex))
        .map(async (path$1) => {
        const extension = path.extname(path$1);
        if (extension.endsWith('.js') || extension.endsWith('.ts') || execOptions.useRequire) {
            const fileExports = await (execOptions.requireMethod ? execOptions.requireMethod : require$)(path$1);
            const extractedExport = extractExports(fileExports, execOptions.exportNames);
            if (extractedExport.resolver) {
                return extractedExport.resolver;
            }
            if (extractedExport.resolvers) {
                return extractedExport.resolvers;
            }
            return extractedExport;
        }
        else {
            return readFile(path$1, { encoding: 'utf-8' });
        }
    }));
}
function isIndex(path, extensions = []) {
    const IS_INDEX = /(\/|\\)index\.[^\/\\]+$/i; // (/ or \) AND `index.` AND (everything except \ and /)(end of line)
    return IS_INDEX.test(path) && extensions.some(ext => path.endsWith('.' + ext));
}

exports.loadFiles = loadFiles;
exports.loadFilesSync = loadFilesSync;
//# sourceMappingURL=index.cjs.js.map
