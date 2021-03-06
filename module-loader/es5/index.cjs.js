'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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
const graphql = require('graphql');
const utils = require('@graphql-tools/utils/es5');

var InvalidError = new Error("Imported object was not a string, DocumentNode or GraphQLSchema");
var createLoadError = function (error) {
    return new Error('Unable to load schema from module: ' + ("" + (error.message || /* istanbul ignore next */ error)));
};
// module:node/module#export
function extractData(pointer) {
    var parts = pointer.replace(/^module\:/i, '').split('#');
    if (!parts || parts.length > 2) {
        throw new Error('Schema pointer should match "module:path/to/module#export"');
    }
    return {
        modulePath: parts[0],
        exportName: parts[1],
    };
}
/**
 * * This loader loads documents and type definitions from a Node module
 *
 * ```js
 * const schema = await loadSchema('module:someModuleName#someNamedExport', {
 *   loaders: [new ModuleLoader()],
 * })
 * ```
 */
var ModuleLoader = /** @class */ (function () {
    function ModuleLoader() {
    }
    ModuleLoader.prototype.loaderId = function () {
        return 'module-loader';
    };
    ModuleLoader.prototype.canLoad = function (pointer) {
        return tslib.__awaiter(this, void 0, void 0, function () {
            return tslib.__generator(this, function (_a) {
                return [2 /*return*/, this.canLoadSync(pointer)];
            });
        });
    };
    ModuleLoader.prototype.canLoadSync = function (pointer) {
        return typeof pointer === 'string' && pointer.toLowerCase().startsWith('module:');
    };
    ModuleLoader.prototype.load = function (pointer, options) {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var result, _a, _b, error_1;
            return tslib.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        _a = this.parse;
                        _b = [pointer, options];
                        return [4 /*yield*/, this.importModule(pointer)];
                    case 1:
                        result = _a.apply(this, _b.concat([_c.sent()]));
                        if (result) {
                            return [2 /*return*/, result];
                        }
                        throw InvalidError;
                    case 2:
                        error_1 = _c.sent();
                        throw createLoadError(error_1);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ModuleLoader.prototype.loadSync = function (pointer, options) {
        try {
            var result = this.parse(pointer, options, this.importModuleSync(pointer));
            if (result) {
                return result;
            }
            throw InvalidError;
        }
        catch (error) {
            throw createLoadError(error);
        }
    };
    ModuleLoader.prototype.parse = function (pointer, options, importedModule) {
        if (graphql.isSchema(importedModule)) {
            var schema_1 = utils.fixSchemaAst(importedModule, options);
            return {
                schema: schema_1,
                get document() {
                    return graphql.parse(utils.printSchemaWithDirectives(schema_1, options));
                },
                location: pointer,
            };
        }
        else if (typeof importedModule === 'string') {
            return {
                location: pointer,
                document: graphql.parse(importedModule),
            };
        }
        else if (typeof importedModule === 'object' && importedModule.kind === 'Document') {
            return {
                location: pointer,
                document: importedModule,
            };
        }
    };
    ModuleLoader.prototype.extractFromModule = function (mod, modulePath, identifier) {
        var thing = identifier ? mod[identifier] : mod;
        if (!thing) {
            throw new Error('Unable to import an object from module: ' + modulePath);
        }
        return thing;
    };
    // Sync and Async
    ModuleLoader.prototype.importModule = function (pointer) {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var _a, modulePath, exportName, imported;
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = extractData(pointer), modulePath = _a.modulePath, exportName = _a.exportName;
                        return [4 /*yield*/, new Promise(function (resolve) { resolve(_interopNamespace(require(modulePath))); })];
                    case 1:
                        imported = _b.sent();
                        return [2 /*return*/, this.extractFromModule(imported, modulePath, exportName || 'default')];
                }
            });
        });
    };
    ModuleLoader.prototype.importModuleSync = function (pointer) {
        var _a = extractData(pointer), modulePath = _a.modulePath, exportName = _a.exportName;
        var imported = require(modulePath);
        return this.extractFromModule(imported, modulePath, exportName);
    };
    return ModuleLoader;
}());

exports.ModuleLoader = ModuleLoader;
//# sourceMappingURL=index.cjs.js.map
