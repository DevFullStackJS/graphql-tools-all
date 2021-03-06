'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const tslib = require('tslib');
const graphqlTagPluck = require('@graphql-tools/graphql-tag-pluck/es5');
const child_process = require('child_process');
const utils = require('@graphql-tools/utils/es5');

var createLoadError = function (error) { return new Error('Unable to load file from git: ' + error); };
var createCommand = function (_a) {
    var ref = _a.ref, path = _a.path;
    return "git show " + ref + ":" + path;
};
/**
 * @internal
 */
function loadFromGit(input) {
    return tslib.__awaiter(this, void 0, void 0, function () {
        var error_1;
        return tslib.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            child_process.exec(createCommand(input), { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 1024 }, function (error, stdout) {
                                if (error) {
                                    reject(error);
                                }
                                else {
                                    resolve(stdout);
                                }
                            });
                        })];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_1 = _a.sent();
                    throw createLoadError(error_1);
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * @internal
 */
function loadFromGitSync(input) {
    try {
        return child_process.execSync(createCommand(input), { encoding: 'utf-8' });
    }
    catch (error) {
        throw createLoadError(error);
    }
}

/**
 * @internal
 */
function parse(_a) {
    var path = _a.path, pointer = _a.pointer, content = _a.content, options = _a.options;
    if (/\.(gql|graphql)s?$/i.test(path)) {
        return utils.parseGraphQLSDL(pointer, content, options);
    }
    if (/\.json$/i.test(path)) {
        return utils.parseGraphQLJSON(pointer, content, options);
    }
}

// git:branch:path/to/file
function extractData(pointer) {
    var parts = pointer.replace(/^git\:/i, '').split(':');
    if (!parts || parts.length !== 2) {
        throw new Error('Schema pointer should match "git:branchName:path/to/file"');
    }
    return {
        ref: parts[0],
        path: parts[1],
    };
}
/**
 * This loader loads a file from git.
 *
 * ```js
 * const typeDefs = await loadTypedefs('git:someBranch:some/path/to/file.js', {
 *   loaders: [new GitLoader()],
 * })
 * ```
 */
var GitLoader = /** @class */ (function () {
    function GitLoader() {
    }
    GitLoader.prototype.loaderId = function () {
        return 'git-loader';
    };
    GitLoader.prototype.canLoad = function (pointer) {
        return tslib.__awaiter(this, void 0, void 0, function () {
            return tslib.__generator(this, function (_a) {
                return [2 /*return*/, this.canLoadSync(pointer)];
            });
        });
    };
    GitLoader.prototype.canLoadSync = function (pointer) {
        return typeof pointer === 'string' && pointer.toLowerCase().startsWith('git:');
    };
    GitLoader.prototype.load = function (pointer, options) {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var _a, ref, path, content, parsed, rawSDL;
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = extractData(pointer), ref = _a.ref, path = _a.path;
                        return [4 /*yield*/, loadFromGit({ ref: ref, path: path })];
                    case 1:
                        content = _b.sent();
                        parsed = parse({ path: path, options: options, pointer: pointer, content: content });
                        if (parsed) {
                            return [2 /*return*/, parsed];
                        }
                        return [4 /*yield*/, graphqlTagPluck.gqlPluckFromCodeString(pointer, content, options.pluckConfig)];
                    case 2:
                        rawSDL = _b.sent();
                        return [2 /*return*/, {
                                location: pointer,
                                rawSDL: rawSDL,
                            }];
                }
            });
        });
    };
    GitLoader.prototype.loadSync = function (pointer, options) {
        var _a = extractData(pointer), ref = _a.ref, path = _a.path;
        var content = loadFromGitSync({ ref: ref, path: path });
        var parsed = parse({ path: path, options: options, pointer: pointer, content: content });
        if (parsed) {
            return parsed;
        }
        var rawSDL = graphqlTagPluck.gqlPluckFromCodeStringSync(pointer, content, options.pluckConfig);
        return {
            location: pointer,
            rawSDL: rawSDL,
        };
    };
    return GitLoader;
}());

exports.GitLoader = GitLoader;
//# sourceMappingURL=index.cjs.js.map
