'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const tslib = require('tslib');
const graphql = require('graphql');
const schema = require('@graphql-tools/schema/es5');
const utils = require('@graphql-tools/utils/es5');

/**
 * A convenience wrapper on top of addMocksToSchema. It adds your mock resolvers
 * to your schema and returns a client that will correctly execute your query with
 * variables. Note: when executing queries from the returned server, context and
 * root will both equal `{}`.
 * @param schema The schema to which to add mocks. This can also be a set of type
 * definitions instead.
 * @param mocks The mocks to add to the schema.
 * @param preserveResolvers Set to `true` to prevent existing resolvers from being
 * overwritten to provide mock data. This can be used to mock some parts of the
 * server and not others.
 */
function mockServer(schema$1, mocks, preserveResolvers) {
    if (preserveResolvers === void 0) { preserveResolvers = false; }
    var mySchema;
    if (!graphql.isSchema(schema$1)) {
        // TODO: provide useful error messages here if this fails
        mySchema = schema.buildSchemaFromTypeDefinitions(schema$1);
    }
    else {
        mySchema = schema$1;
    }
    mySchema = addMocksToSchema({ schema: mySchema, mocks: mocks, preserveResolvers: preserveResolvers });
    return { query: function (query, vars) { return graphql.graphql(mySchema, query, {}, {}, vars); } };
}
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        // eslint-disable-next-line eqeqeq
        var v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
var defaultMockMap = new Map();
defaultMockMap.set('Int', function () { return Math.round(Math.random() * 200) - 100; });
defaultMockMap.set('Float', function () { return Math.random() * 200 - 100; });
defaultMockMap.set('String', function () { return 'Hello World'; });
defaultMockMap.set('Boolean', function () { return Math.random() > 0.5; });
defaultMockMap.set('ID', function () { return uuidv4(); });
// TODO allow providing a seed such that lengths of list could be deterministic
// this could be done by using casual to get a random list length if the casual
// object is global.
/**
 * Given an instance of GraphQLSchema and a mock object, returns a new schema
 * that can return mock data for any valid query that is sent to the server.
 * @param options Options object
 */
function addMocksToSchema(_a) {
    var _b;
    var _this = this;
    var schema = _a.schema, _c = _a.mocks, mocks = _c === void 0 ? {} : _c, _d = _a.preserveResolvers, preserveResolvers = _d === void 0 ? false : _d;
    if (!schema) {
        throw new Error('Must provide schema to mock');
    }
    if (!graphql.isSchema(schema)) {
        throw new Error('Value at "schema" must be of type GraphQLSchema');
    }
    if (!isObject(mocks)) {
        throw new Error('mocks must be of type Object');
    }
    // use Map internally, because that API is nicer.
    var mockFunctionMap = new Map();
    Object.keys(mocks).forEach(function (typeName) {
        mockFunctionMap.set(typeName, mocks[typeName]);
    });
    mockFunctionMap.forEach(function (mockFunction, mockTypeName) {
        if (typeof mockFunction !== 'function') {
            throw new Error("mockFunctionMap[" + mockTypeName + "] must be a function");
        }
    });
    var mockType = function (type, _typeName, fieldName) {
        // order of precendence for mocking:
        // 1. if the object passed in already has fieldName, just use that
        // --> if it's a function, that becomes your resolver
        // --> if it's a value, the mock resolver will return that
        // 2. if the nullableType is a list, recurse
        // 2. if there's a mock defined for this typeName, that will be used
        // 3. if there's no mock defined, use the default mocks for this type
        return function (root, args, context, info) {
            // nullability doesn't matter for the purpose of mocking.
            var fieldType = graphql.getNullableType(type);
            var namedFieldType = graphql.getNamedType(fieldType);
            if (fieldName && root && typeof root[fieldName] !== 'undefined') {
                var result = void 0;
                // if we're here, the field is already defined
                if (typeof root[fieldName] === 'function') {
                    result = root[fieldName](args, context, info);
                    if (isMockList(result)) {
                        result = result.mock(root, args, context, info, fieldType, mockType);
                    }
                }
                else {
                    result = root[fieldName];
                }
                // Now we merge the result with the default mock for this type.
                // This allows overriding defaults while writing very little code.
                if (mockFunctionMap.has(namedFieldType.name)) {
                    var mock = mockFunctionMap.get(namedFieldType.name);
                    result = mergeMocks(mock.bind(null, root, args, context, info), result);
                }
                return result;
            }
            if (graphql.isListType(fieldType)) {
                return [
                    mockType(fieldType.ofType)(root, args, context, info),
                    mockType(fieldType.ofType)(root, args, context, info),
                ];
            }
            if (mockFunctionMap.has(fieldType.name) && !graphql.isAbstractType(fieldType)) {
                // the object passed doesn't have this field, so we apply the default mock
                var mock = mockFunctionMap.get(fieldType.name);
                return mock(root, args, context, info);
            }
            if (graphql.isObjectType(fieldType)) {
                // objects don't return actual data, we only need to mock scalars!
                return {};
            }
            // if a mock function is provided for unionType or interfaceType, execute it to resolve the concrete type
            // otherwise randomly pick a type from all implementation types
            if (graphql.isAbstractType(fieldType)) {
                var implementationType = void 0;
                var interfaceMockObj = {};
                if (mockFunctionMap.has(fieldType.name)) {
                    var mock = mockFunctionMap.get(fieldType.name);
                    interfaceMockObj = mock(root, args, context, info);
                    if (!interfaceMockObj || !interfaceMockObj.__typename) {
                        return Error("Please return a __typename in \"" + fieldType.name + "\"");
                    }
                    implementationType = schema.getType(interfaceMockObj.__typename);
                }
                else {
                    var possibleTypes = schema.getPossibleTypes(fieldType);
                    implementationType = getRandomElement(possibleTypes);
                }
                return tslib.__assign(tslib.__assign({ __typename: implementationType }, interfaceMockObj), mockType(implementationType)(root, args, context, info));
            }
            if (graphql.isEnumType(fieldType)) {
                return getRandomElement(fieldType.getValues()).value;
            }
            if (defaultMockMap.has(fieldType.name)) {
                var defaultMock = defaultMockMap.get(fieldType.name);
                return defaultMock(root, args, context, info);
            }
            // if we get to here, we don't have a value, and we don't have a mock for this type,
            // we could return undefined, but that would be hard to debug, so we throw instead.
            // however, we returning it instead of throwing it, so preserveResolvers can handle the failures.
            return Error("No mock defined for type \"" + fieldType.name + "\"");
        };
    };
    return utils.mapSchema(schema, (_b = {},
        _b[utils.MapperKind.ABSTRACT_TYPE] = function (type) {
            var oldResolveType = type.resolveType;
            if (preserveResolvers && oldResolveType != null && oldResolveType.length) {
                return;
            }
            // the default `resolveType` always returns null. We add a fallback
            // resolution that works with how unions and interface are mocked
            var resolveType = function (data, _context, info) {
                return info.schema.getType(data.__typename);
            };
            if (graphql.isInterfaceType(type)) {
                return new graphql.GraphQLInterfaceType(tslib.__assign(tslib.__assign({}, type.toConfig()), { resolveType: resolveType }));
            }
            else {
                return new graphql.GraphQLUnionType(tslib.__assign(tslib.__assign({}, type.toConfig()), { resolveType: resolveType }));
            }
        },
        _b[utils.MapperKind.OBJECT_FIELD] = function (fieldConfig, fieldName, typeName) {
            var fieldType = fieldConfig.type;
            var fieldResolver = fieldConfig.resolve;
            var newFieldConfig = tslib.__assign({}, fieldConfig);
            var mockResolver = mockType(fieldType, typeName, fieldName);
            // we have to handle the root mutation and root query types differently,
            // because no resolver is called at the root.
            var queryType = schema.getQueryType();
            var isOnQueryType = queryType != null && queryType.name === typeName;
            var mutationType = schema.getMutationType();
            var isOnMutationType = mutationType != null && mutationType.name === typeName;
            var subscriptionType = schema.getSubscriptionType();
            var isOnSubscriptionType = subscriptionType != null && subscriptionType.name === typeName;
            if (isOnQueryType || isOnMutationType || isOnSubscriptionType) {
                if (mockFunctionMap.has(typeName)) {
                    var rootMock_1 = mockFunctionMap.get(typeName);
                    // XXX: BUG in here, need to provide proper signature for rootMock.
                    if (typeof rootMock_1(undefined, {}, {}, {})[fieldName] === 'function') {
                        mockResolver = function (root, args, context, info) {
                            var updatedRoot = root !== null && root !== void 0 ? root : {}; // TODO: should we clone instead?
                            updatedRoot[fieldName] = rootMock_1(root, args, context, info)[fieldName];
                            // XXX this is a bit of a hack to still use mockType, which
                            // lets you mock lists etc. as well
                            // otherwise we could just set field.resolve to rootMock()[fieldName]
                            // it's like pretending there was a resolver that ran before
                            // the root resolver.
                            var result = mockType(fieldConfig.type, typeName, fieldName)(updatedRoot, args, context, info);
                            return result;
                        };
                    }
                }
            }
            if (!preserveResolvers || !fieldResolver) {
                newFieldConfig.resolve = mockResolver;
            }
            else {
                var oldResolver_1 = fieldResolver;
                newFieldConfig.resolve = function (rootObject, args, context, info) {
                    return Promise.all([
                        mockResolver(rootObject, args, context, info),
                        oldResolver_1(rootObject, args, context, info),
                    ]).then(function (values) {
                        var _a = tslib.__read(values, 2), mockedValue = _a[0], resolvedValue = _a[1];
                        // In case we couldn't mock
                        if (mockedValue instanceof Error) {
                            // only if value was not resolved, populate the error.
                            if (undefined === resolvedValue) {
                                throw mockedValue;
                            }
                            return resolvedValue;
                        }
                        if (resolvedValue instanceof Date && mockedValue instanceof Date) {
                            return undefined !== resolvedValue ? resolvedValue : mockedValue;
                        }
                        if (isObject(mockedValue) && isObject(resolvedValue)) {
                            // Object.assign() won't do here, as we need to all properties, including
                            // the non-enumerable ones and defined using Object.defineProperty
                            var emptyObject = Object.create(Object.getPrototypeOf(resolvedValue));
                            return copyOwnProps(emptyObject, resolvedValue, mockedValue);
                        }
                        return undefined !== resolvedValue ? resolvedValue : mockedValue;
                    });
                };
            }
            var fieldSubscriber = fieldConfig.subscribe;
            var mockSubscriber = function () {
                var _a;
                var _args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _args[_i] = arguments[_i];
                }
                return (_a = {},
                    _a[Symbol.asyncIterator] = function () {
                        return {
                            next: function () {
                                return tslib.__awaiter(this, void 0, void 0, function () {
                                    return tslib.__generator(this, function (_a) {
                                        return [2 /*return*/, {
                                                done: true,
                                                value: {},
                                            }];
                                    });
                                });
                            },
                        };
                    },
                    _a);
            };
            if (!preserveResolvers || !fieldSubscriber) {
                newFieldConfig.subscribe = mockSubscriber;
            }
            else {
                newFieldConfig.subscribe = function (rootObject, args, context, info) { return tslib.__awaiter(_this, void 0, void 0, function () {
                    var _a, mockAsyncIterable, oldAsyncIterable;
                    return tslib.__generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, Promise.all([
                                    mockSubscriber(rootObject, args, context, info),
                                    fieldSubscriber(rootObject, args, context, info),
                                ])];
                            case 1:
                                _a = tslib.__read.apply(void 0, [_b.sent(), 2]), mockAsyncIterable = _a[0], oldAsyncIterable = _a[1];
                                return [2 /*return*/, oldAsyncIterable || mockAsyncIterable];
                        }
                    });
                }); };
            }
            return newFieldConfig;
        },
        _b));
}
function isObject(thing) {
    return thing === Object(thing) && !Array.isArray(thing);
}
// returns a random element from that ary
function getRandomElement(ary) {
    var sample = Math.floor(Math.random() * ary.length);
    return ary[sample];
}
function mergeObjects(a, b) {
    return Object.assign(a, b);
}
function copyOwnPropsIfNotPresent(target, source) {
    Object.getOwnPropertyNames(source).forEach(function (prop) {
        if (!Object.getOwnPropertyDescriptor(target, prop)) {
            var propertyDescriptor = Object.getOwnPropertyDescriptor(source, prop);
            Object.defineProperty(target, prop, propertyDescriptor == null ? {} : propertyDescriptor);
        }
    });
}
function copyOwnProps(target) {
    var sources = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        sources[_i - 1] = arguments[_i];
    }
    sources.forEach(function (source) {
        var chain = source;
        while (chain != null) {
            copyOwnPropsIfNotPresent(target, chain);
            chain = Object.getPrototypeOf(chain);
        }
    });
    return target;
}
// takes either an object or a (possibly nested) array
// and completes the customMock object with any fields
// defined on genericMock
// only merges objects or arrays. Scalars are returned as is
function mergeMocks(genericMockFunction, customMock) {
    if (Array.isArray(customMock)) {
        return customMock.map(function (el) { return mergeMocks(genericMockFunction, el); });
    }
    if (customMock instanceof Promise) {
        return customMock.then(function (res) { return mergeObjects(genericMockFunction(), res); });
    }
    if (isObject(customMock)) {
        return mergeObjects(genericMockFunction(), customMock);
    }
    return customMock;
}
/**
 * @internal
 */
function isMockList(obj) {
    if (typeof (obj === null || obj === void 0 ? void 0 : obj.len) === 'number' || (Array.isArray(obj === null || obj === void 0 ? void 0 : obj.len) && typeof (obj === null || obj === void 0 ? void 0 : obj.len[0]) === 'number')) {
        if (typeof obj.wrappedFunction === 'undefined' || typeof obj.wrappedFunction === 'function') {
            return true;
        }
    }
    return false;
}
/**
 * This is an object you can return from your mock resolvers which calls the
 * provided `mockFunction` once for each list item.
 */
var MockList = /** @class */ (function () {
    /**
     * @param length Either the exact length of items to return or an inclusive
     * range of possible lengths.
     * @param mockFunction The function to call for each item in the list to
     * resolve it. It can return another MockList or a value.
     */
    function MockList(length, mockFunction) {
        this.len = length;
        if (typeof mockFunction !== 'undefined') {
            if (typeof mockFunction !== 'function') {
                throw new Error('Second argument to MockList must be a function or undefined');
            }
            this.wrappedFunction = mockFunction;
        }
    }
    /**
     * @internal
     */
    MockList.prototype.mock = function (root, args, context, info, fieldType, mockTypeFunc) {
        var arr;
        if (Array.isArray(this.len)) {
            arr = new Array(this.randint(this.len[0], this.len[1]));
        }
        else {
            arr = new Array(this.len);
        }
        for (var i = 0; i < arr.length; i++) {
            if (typeof this.wrappedFunction === 'function') {
                var res = this.wrappedFunction(root, args, context, info);
                if (isMockList(res)) {
                    var nullableType = graphql.getNullableType(fieldType.ofType);
                    arr[i] = res.mock(root, args, context, info, nullableType, mockTypeFunc);
                }
                else {
                    arr[i] = res;
                }
            }
            else {
                arr[i] = mockTypeFunc(fieldType.ofType)(root, args, context, info);
            }
        }
        return arr;
    };
    MockList.prototype.randint = function (low, high) {
        return Math.floor(Math.random() * (high - low + 1) + low);
    };
    return MockList;
}());

exports.MockList = MockList;
exports.addMocksToSchema = addMocksToSchema;
exports.isMockList = isMockList;
exports.mockServer = mockServer;
//# sourceMappingURL=index.cjs.js.map
