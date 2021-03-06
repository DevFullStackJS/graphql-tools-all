import { __awaiter, __generator, __assign } from 'tslib';
import { GraphQLError, GraphQLList, getNamedType } from 'graphql';
import DataLoader from 'dataloader';
import { delegateToSchema } from '@graphql-tools/delegate/es5';

var VisitSchemaKind;
(function (VisitSchemaKind) {
    VisitSchemaKind["TYPE"] = "VisitSchemaKind.TYPE";
    VisitSchemaKind["SCALAR_TYPE"] = "VisitSchemaKind.SCALAR_TYPE";
    VisitSchemaKind["ENUM_TYPE"] = "VisitSchemaKind.ENUM_TYPE";
    VisitSchemaKind["COMPOSITE_TYPE"] = "VisitSchemaKind.COMPOSITE_TYPE";
    VisitSchemaKind["OBJECT_TYPE"] = "VisitSchemaKind.OBJECT_TYPE";
    VisitSchemaKind["INPUT_OBJECT_TYPE"] = "VisitSchemaKind.INPUT_OBJECT_TYPE";
    VisitSchemaKind["ABSTRACT_TYPE"] = "VisitSchemaKind.ABSTRACT_TYPE";
    VisitSchemaKind["UNION_TYPE"] = "VisitSchemaKind.UNION_TYPE";
    VisitSchemaKind["INTERFACE_TYPE"] = "VisitSchemaKind.INTERFACE_TYPE";
    VisitSchemaKind["ROOT_OBJECT"] = "VisitSchemaKind.ROOT_OBJECT";
    VisitSchemaKind["QUERY"] = "VisitSchemaKind.QUERY";
    VisitSchemaKind["MUTATION"] = "VisitSchemaKind.MUTATION";
    VisitSchemaKind["SUBSCRIPTION"] = "VisitSchemaKind.SUBSCRIPTION";
})(VisitSchemaKind || (VisitSchemaKind = {}));
var MapperKind;
(function (MapperKind) {
    MapperKind["TYPE"] = "MapperKind.TYPE";
    MapperKind["SCALAR_TYPE"] = "MapperKind.SCALAR_TYPE";
    MapperKind["ENUM_TYPE"] = "MapperKind.ENUM_TYPE";
    MapperKind["COMPOSITE_TYPE"] = "MapperKind.COMPOSITE_TYPE";
    MapperKind["OBJECT_TYPE"] = "MapperKind.OBJECT_TYPE";
    MapperKind["INPUT_OBJECT_TYPE"] = "MapperKind.INPUT_OBJECT_TYPE";
    MapperKind["ABSTRACT_TYPE"] = "MapperKind.ABSTRACT_TYPE";
    MapperKind["UNION_TYPE"] = "MapperKind.UNION_TYPE";
    MapperKind["INTERFACE_TYPE"] = "MapperKind.INTERFACE_TYPE";
    MapperKind["ROOT_OBJECT"] = "MapperKind.ROOT_OBJECT";
    MapperKind["QUERY"] = "MapperKind.QUERY";
    MapperKind["MUTATION"] = "MapperKind.MUTATION";
    MapperKind["SUBSCRIPTION"] = "MapperKind.SUBSCRIPTION";
    MapperKind["DIRECTIVE"] = "MapperKind.DIRECTIVE";
    MapperKind["FIELD"] = "MapperKind.FIELD";
    MapperKind["COMPOSITE_FIELD"] = "MapperKind.COMPOSITE_FIELD";
    MapperKind["OBJECT_FIELD"] = "MapperKind.OBJECT_FIELD";
    MapperKind["ROOT_FIELD"] = "MapperKind.ROOT_FIELD";
    MapperKind["QUERY_ROOT_FIELD"] = "MapperKind.QUERY_ROOT_FIELD";
    MapperKind["MUTATION_ROOT_FIELD"] = "MapperKind.MUTATION_ROOT_FIELD";
    MapperKind["SUBSCRIPTION_ROOT_FIELD"] = "MapperKind.SUBSCRIPTION_ROOT_FIELD";
    MapperKind["INTERFACE_FIELD"] = "MapperKind.INTERFACE_FIELD";
    MapperKind["INPUT_OBJECT_FIELD"] = "MapperKind.INPUT_OBJECT_FIELD";
    MapperKind["ARGUMENT"] = "MapperKind.ARGUMENT";
    MapperKind["ENUM_VALUE"] = "MapperKind.ENUM_VALUE";
})(MapperKind || (MapperKind = {}));

function relocatedError(originalError, path) {
    return new GraphQLError(originalError.message, originalError.nodes, originalError.source, originalError.positions, path === null ? undefined : path === undefined ? originalError.path : path, originalError.originalError, originalError.extensions);
}

var cache1 = new WeakMap();
function createBatchFn(options) {
    var _this = this;
    var _a;
    var argsFromKeys = (_a = options.argsFromKeys) !== null && _a !== void 0 ? _a : (function (keys) { return ({ ids: keys }); });
    var valuesFromResults = options.valuesFromResults, lazyOptionsFn = options.lazyOptionsFn;
    return function (keys) { return __awaiter(_this, void 0, void 0, function () {
        var results, values;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, delegateToSchema(__assign({ returnType: new GraphQLList(getNamedType(options.info.returnType)), onLocatedError: function (originalError) {
                            return relocatedError(originalError, originalError.path.slice(0, 0).concat(originalError.path.slice(2)));
                        }, args: argsFromKeys(keys) }, (lazyOptionsFn == null ? options : lazyOptionsFn(options))))];
                case 1:
                    results = _a.sent();
                    if (results instanceof Error) {
                        return [2 /*return*/, keys.map(function () { return results; })];
                    }
                    values = valuesFromResults == null ? results : valuesFromResults(results, keys);
                    return [2 /*return*/, Array.isArray(values) ? values : keys.map(function () { return values; })];
            }
        });
    }); };
}
function getLoader(options) {
    var cache2 = cache1.get(options.info.fieldNodes);
    var loader;
    if (cache2 === undefined) {
        var batchFn_1 = createBatchFn(options);
        cache2 = new WeakMap();
        cache1.set(options.info.fieldNodes, cache2);
        loader = new DataLoader(function (keys) { return batchFn_1(keys); }, options.dataLoaderOptions);
        cache2.set(options.schema, loader);
        return loader;
    }
    loader = cache2.get(options.schema);
    if (loader === undefined) {
        var batchFn_2 = createBatchFn(options);
        loader = new DataLoader(function (keys) { return batchFn_2(keys); }, options.dataLoaderOptions);
        cache2.set(options.schema, loader);
        return loader;
    }
    return loader;
}

function batchDelegateToSchema(options) {
    var key = options.key;
    if (key == null) {
        return null;
    }
    else if (Array.isArray(key) && !key.length) {
        return [];
    }
    var loader = getLoader(options);
    return Array.isArray(key) ? loader.loadMany(key) : loader.load(key);
}

function createBatchDelegateFn(optionsOrArgsFromKeys, lazyOptionsFn, dataLoaderOptions, valuesFromResults) {
    return typeof optionsOrArgsFromKeys === 'function'
        ? createBatchDelegateFnImpl({
            argsFromKeys: optionsOrArgsFromKeys,
            lazyOptionsFn: lazyOptionsFn,
            dataLoaderOptions: dataLoaderOptions,
            valuesFromResults: valuesFromResults,
        })
        : createBatchDelegateFnImpl(optionsOrArgsFromKeys);
}
function createBatchDelegateFnImpl(options) {
    return function (batchDelegateOptions) {
        var loader = getLoader(__assign(__assign({}, options), batchDelegateOptions));
        return loader.load(batchDelegateOptions.key);
    };
}

export { batchDelegateToSchema, createBatchDelegateFn };
//# sourceMappingURL=index.esm.js.map
