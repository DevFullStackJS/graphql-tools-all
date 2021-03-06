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

const tslib = require('tslib');
const globby = require('globby');
const globby__default = _interopDefault(globby);
const unixify = _interopDefault(require('unixify'));
const path = require('path');
const fs = require('fs');

var readFile = fs.promises.readFile, stat = fs.promises.stat;
var DEFAULT_IGNORED_EXTENSIONS = ['spec', 'test', 'd', 'map'];
var DEFAULT_EXTENSIONS = ['gql', 'graphql', 'graphqls', 'ts', 'js'];
var DEFAULT_EXPORT_NAMES = ['typeDefs', 'schema'];
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
        var pathStat = fs.statSync(path);
        return pathStat.isDirectory();
    }
    catch (e) {
        return false;
    }
}
function isDirectory(path) {
    return tslib.__awaiter(this, void 0, void 0, function () {
        var pathStat, e_1;
        return tslib.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, stat(path)];
                case 1:
                    pathStat = _a.sent();
                    return [2 /*return*/, pathStat.isDirectory()];
                case 2:
                    e_1 = _a.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function scanForFilesSync(globStr, globOptions) {
    if (globOptions === void 0) { globOptions = {}; }
    return globby.sync(globStr, tslib.__assign({ absolute: true }, globOptions));
}
function buildGlob(basePath, extensions, ignoredExtensions, recursive) {
    if (ignoredExtensions === void 0) { ignoredExtensions = []; }
    var ignored = ignoredExtensions.length > 0 ? "!(" + ignoredExtensions.map(function (e) { return '*.' + e; }).join('|') + ")" : '*';
    var ext = extensions.map(function (e) { return '*.' + e; }).join('|');
    return "" + basePath + (recursive ? '/**' : '') + "/" + ignored + "+(" + ext + ")";
}
function extractExports(fileExport, exportNames) {
    var e_2, _a, e_3, _b;
    if (!fileExport) {
        return null;
    }
    if (fileExport.default) {
        try {
            for (var exportNames_1 = tslib.__values(exportNames), exportNames_1_1 = exportNames_1.next(); !exportNames_1_1.done; exportNames_1_1 = exportNames_1.next()) {
                var exportName = exportNames_1_1.value;
                if (fileExport.default[exportName]) {
                    return fileExport.default[exportName];
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (exportNames_1_1 && !exportNames_1_1.done && (_a = exportNames_1.return)) _a.call(exportNames_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return fileExport.default;
    }
    try {
        for (var exportNames_2 = tslib.__values(exportNames), exportNames_2_1 = exportNames_2.next(); !exportNames_2_1.done; exportNames_2_1 = exportNames_2.next()) {
            var exportName = exportNames_2_1.value;
            if (fileExport[exportName]) {
                return fileExport[exportName];
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (exportNames_2_1 && !exportNames_2_1.done && (_b = exportNames_2.return)) _b.call(exportNames_2);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return fileExport;
}
var LoadFilesDefaultOptions = {
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
function loadFilesSync(pattern, options) {
    if (options === void 0) { options = LoadFilesDefaultOptions; }
    var execOptions = tslib.__assign(tslib.__assign({}, LoadFilesDefaultOptions), options);
    var relevantPaths = scanForFilesSync(asArray(pattern).map(function (path) {
        return isDirectorySync(path)
            ? buildGlob(unixify(path), execOptions.extensions, execOptions.ignoredExtensions, execOptions.recursive)
            : unixify(path);
    }), options.globOptions);
    return relevantPaths
        .map(function (path$1) {
        if (!checkExtension(path$1, options)) {
            return null;
        }
        if (isIndex(path$1, execOptions.extensions) && options.ignoreIndex) {
            return false;
        }
        var extension = path.extname(path$1);
        if (extension.endsWith('.js') || extension.endsWith('.ts') || execOptions.useRequire) {
            var fileExports = (execOptions.requireMethod ? execOptions.requireMethod : require)(path$1);
            var extractedExport = extractExports(fileExports, execOptions.exportNames);
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
        .filter(function (v) { return v; });
}
function scanForFiles(globStr, globOptions) {
    if (globOptions === void 0) { globOptions = {}; }
    return tslib.__awaiter(this, void 0, void 0, function () {
        return tslib.__generator(this, function (_a) {
            return [2 /*return*/, globby__default(globStr, tslib.__assign({ absolute: true }, globOptions))];
        });
    });
}
var checkExtension = function (path, _a) {
    var e_4, _b, e_5, _c;
    var extensions = _a.extensions, ignoredExtensions = _a.ignoredExtensions;
    if (ignoredExtensions) {
        try {
            for (var ignoredExtensions_1 = tslib.__values(ignoredExtensions), ignoredExtensions_1_1 = ignoredExtensions_1.next(); !ignoredExtensions_1_1.done; ignoredExtensions_1_1 = ignoredExtensions_1.next()) {
                var ignoredExtension = ignoredExtensions_1_1.value;
                if (path.endsWith(ignoredExtension)) {
                    return false;
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (ignoredExtensions_1_1 && !ignoredExtensions_1_1.done && (_b = ignoredExtensions_1.return)) _b.call(ignoredExtensions_1);
            }
            finally { if (e_4) throw e_4.error; }
        }
    }
    if (!extensions) {
        return true;
    }
    try {
        for (var extensions_1 = tslib.__values(extensions), extensions_1_1 = extensions_1.next(); !extensions_1_1.done; extensions_1_1 = extensions_1.next()) {
            var extension = extensions_1_1.value;
            if (path.endsWith(extension)) {
                return true;
            }
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (extensions_1_1 && !extensions_1_1.done && (_c = extensions_1.return)) _c.call(extensions_1);
        }
        finally { if (e_5) throw e_5.error; }
    }
    return false;
};
/**
 * Asynchronously loads files using the provided glob pattern.
 * @param pattern Glob pattern or patterns to use when loading files
 * @param options Additional options
 */
function loadFiles(pattern, options) {
    if (options === void 0) { options = LoadFilesDefaultOptions; }
    return tslib.__awaiter(this, void 0, void 0, function () {
        var execOptions, relevantPaths, _a, require$;
        var _this = this;
        return tslib.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    execOptions = tslib.__assign(tslib.__assign({}, LoadFilesDefaultOptions), options);
                    _a = scanForFiles;
                    return [4 /*yield*/, Promise.all(asArray(pattern).map(function (path) { return tslib.__awaiter(_this, void 0, void 0, function () {
                            return tslib.__generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, isDirectory(path)];
                                    case 1: return [2 /*return*/, (_a.sent())
                                            ? buildGlob(unixify(path), execOptions.extensions, execOptions.ignoredExtensions, execOptions.recursive)
                                            : unixify(path)];
                                }
                            });
                        }); }))];
                case 1: return [4 /*yield*/, _a.apply(void 0, [_b.sent(), options.globOptions])];
                case 2:
                    relevantPaths = _b.sent();
                    require$ = function (path) { return new Promise(function (resolve) { resolve(_interopNamespace(require(path))); }).catch(function () { return tslib.__awaiter(_this, void 0, void 0, function () { return tslib.__generator(this, function (_a) {
                        return [2 /*return*/, require(path)];
                    }); }); }); };
                    return [2 /*return*/, Promise.all(relevantPaths
                            .filter(function (path) { return checkExtension(path, options) && !(isIndex(path, execOptions.extensions) && options.ignoreIndex); })
                            .map(function (path$1) { return tslib.__awaiter(_this, void 0, void 0, function () {
                            var extension, fileExports, extractedExport;
                            return tslib.__generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        extension = path.extname(path$1);
                                        if (!(extension.endsWith('.js') || extension.endsWith('.ts') || execOptions.useRequire)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, (execOptions.requireMethod ? execOptions.requireMethod : require$)(path$1)];
                                    case 1:
                                        fileExports = _a.sent();
                                        extractedExport = extractExports(fileExports, execOptions.exportNames);
                                        if (extractedExport.resolver) {
                                            return [2 /*return*/, extractedExport.resolver];
                                        }
                                        if (extractedExport.resolvers) {
                                            return [2 /*return*/, extractedExport.resolvers];
                                        }
                                        return [2 /*return*/, extractedExport];
                                    case 2: return [2 /*return*/, readFile(path$1, { encoding: 'utf-8' })];
                                }
                            });
                        }); }))];
            }
        });
    });
}
function isIndex(path, extensions) {
    if (extensions === void 0) { extensions = []; }
    var IS_INDEX = /(\/|\\)index\.[^\/\\]+$/i; // (/ or \) AND `index.` AND (everything except \ and /)(end of line)
    return IS_INDEX.test(path) && extensions.some(function (ext) { return path.endsWith('.' + ext); });
}

exports.loadFiles = loadFiles;
exports.loadFilesSync = loadFilesSync;
//# sourceMappingURL=index.cjs.js.map
