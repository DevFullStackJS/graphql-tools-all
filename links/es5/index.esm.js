import { __extends, __assign, __awaiter, __generator } from 'tslib';
import { ApolloLink, concat, execute } from '@apollo/client/link/core';
import { createUploadLink, isExtractableFile, formDataAppendFile } from 'apollo-upload-client';
import FormData from 'form-data';
import { fetch } from 'cross-fetch';
import { Observable } from '@apollo/client/utilities';
import { toPromise } from '@apollo/client/link/utils';
import { observableToAsyncIterable } from '@graphql-tools/utils/es5';
import { GraphQLScalarType, GraphQLError } from 'graphql';
import isPromise from 'is-promise';

function getFinalPromise(object) {
    return Promise.resolve(object).then(function (resolvedObject) {
        if (resolvedObject == null) {
            return resolvedObject;
        }
        if (Array.isArray(resolvedObject)) {
            return Promise.all(resolvedObject.map(function (o) { return getFinalPromise(o); }));
        }
        else if (typeof resolvedObject === 'object') {
            var keys_1 = Object.keys(resolvedObject);
            return Promise.all(keys_1.map(function (key) { return getFinalPromise(resolvedObject[key]); })).then(function (awaitedValues) {
                for (var i = 0; i < keys_1.length; i++) {
                    resolvedObject[keys_1[i]] = awaitedValues[i];
                }
                return resolvedObject;
            });
        }
        return resolvedObject;
    });
}
var AwaitVariablesLink = /** @class */ (function (_super) {
    __extends(AwaitVariablesLink, _super);
    function AwaitVariablesLink() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AwaitVariablesLink.prototype.request = function (operation, forward) {
        return new Observable(function (observer) {
            var subscription;
            getFinalPromise(operation.variables)
                .then(function (resolvedVariables) {
                operation.variables = resolvedVariables;
                subscription = forward(operation).subscribe({
                    next: observer.next.bind(observer),
                    error: observer.error.bind(observer),
                    complete: observer.complete.bind(observer),
                });
            })
                .catch(observer.error.bind(observer));
            return function () {
                if (subscription != null) {
                    subscription.unsubscribe();
                }
            };
        });
    };
    return AwaitVariablesLink;
}(ApolloLink));

var FormDataWithStreamSupport = /** @class */ (function (_super) {
    __extends(FormDataWithStreamSupport, _super);
    function FormDataWithStreamSupport(options) {
        var _this = _super.call(this, options) || this;
        _this.hasUnknowableLength = false;
        return _this;
    }
    FormDataWithStreamSupport.prototype.append = function (key, value, optionsOrFilename) {
        if (optionsOrFilename === void 0) { optionsOrFilename = {}; }
        // allow filename as single option
        var options = typeof optionsOrFilename === 'string' ? { filename: optionsOrFilename } : optionsOrFilename;
        // empty or either doesn't have path or not an http response
        if (!options.knownLength &&
            !Buffer.isBuffer(value) &&
            typeof value !== 'string' &&
            !value.path &&
            !(value.readable && 'httpVersion' in value)) {
            this.hasUnknowableLength = true;
        }
        _super.prototype.append.call(this, key, value, options);
    };
    FormDataWithStreamSupport.prototype.getLength = function (callback) {
        if (this.hasUnknowableLength) {
            return null;
        }
        return _super.prototype.getLength.call(this, callback);
    };
    FormDataWithStreamSupport.prototype.getLengthSync = function () {
        if (this.hasUnknowableLength) {
            return null;
        }
        // eslint-disable-next-line no-sync
        return _super.prototype.getLengthSync.call(this);
    };
    return FormDataWithStreamSupport;
}(FormData));
var createServerHttpLink = function (options) {
    return concat(new AwaitVariablesLink(), createUploadLink(__assign(__assign({}, options), { fetch: fetch, FormData: FormDataWithStreamSupport, isExtractableFile: function (value) { return isExtractableFile(value) || (value === null || value === void 0 ? void 0 : value.createReadStream); }, formDataAppendFile: function (form, index, file) {
            if (file.createReadStream != null) {
                form.append(index, file.createReadStream(), {
                    filename: file.filename,
                    contentType: file.mimetype,
                });
            }
            else {
                formDataAppendFile(form, index, file);
            }
        } })));
};

var linkToExecutor = function (link) { return function (params) {
    var document = params.document, variables = params.variables, extensions = params.extensions, context = params.context, info = params.info;
    return toPromise(execute(link, {
        query: document,
        variables: variables,
        context: {
            graphqlContext: context,
            graphqlResolveInfo: info,
            clientAwareness: {},
        },
        extensions: extensions,
    }));
}; };

var linkToSubscriber = function (link) { return function (params) { return __awaiter(void 0, void 0, void 0, function () {
    var document, variables, extensions, context, info;
    return __generator(this, function (_a) {
        document = params.document, variables = params.variables, extensions = params.extensions, context = params.context, info = params.info;
        return [2 /*return*/, observableToAsyncIterable(execute(link, {
                query: document,
                variables: variables,
                context: {
                    graphqlContext: context,
                    graphqlResolveInfo: info,
                    clientAwareness: {},
                },
                extensions: extensions,
            }))[Symbol.asyncIterator]()];
    });
}); }; };

var GraphQLUpload = new GraphQLScalarType({
    name: 'Upload',
    description: 'The `Upload` scalar type represents a file upload.',
    parseValue: function (value) {
        if (value != null && isPromise(value.promise)) {
            // graphql-upload v10
            return value.promise;
        }
        else if (isPromise(value)) {
            // graphql-upload v9
            return value;
        }
        throw new GraphQLError('Upload value invalid.');
    },
    // serialization requires to support schema stitching
    serialize: function (value) { return value; },
    parseLiteral: function (ast) {
        throw new GraphQLError('Upload literal unsupported.', ast);
    },
});

export { AwaitVariablesLink, GraphQLUpload, createServerHttpLink, linkToExecutor, linkToSubscriber };
//# sourceMappingURL=index.esm.js.map
