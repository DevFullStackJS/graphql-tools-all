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
const parser = require('@babel/parser');
const types = require('@babel/types');
const utils = require('@graphql-tools/utils/es5');
const traverse = _interopDefault(require('@babel/traverse'));

var getExtNameFromFilePath = function (filePath) {
    var partials = filePath.split('.');
    var ext = '.' + partials.pop();
    if (partials.length > 1 && partials[partials.length - 1] === 'flow') {
        ext = '.' + partials.pop() + ext;
    }
    return ext;
};

function generateConfig(filePath, code, _options) {
    var plugins = [
        'asyncGenerators',
        'bigInt',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'decorators-legacy',
        'doExpressions',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'functionBind',
        'functionSent',
        'importMeta',
        'logicalAssignment',
        'nullishCoalescingOperator',
        'numericSeparator',
        'objectRestSpread',
        'optionalCatchBinding',
        'optionalChaining',
        ['pipelineOperator', { proposal: 'smart' }],
        'throwExpressions',
    ];
    // { all: true } option is bullshit thus I do it manually, just in case
    // I still specify it
    var flowPlugins = [['flow', { all: true }], 'flowComments'];
    // If line has @flow header, include flow plug-ins
    var dynamicFlowPlugins = code.includes('@flow') ? flowPlugins : [];
    var fileExt = getExtNameFromFilePath(filePath);
    switch (fileExt) {
        case '.ts':
            plugins.push('typescript');
            break;
        case '.tsx':
            plugins.push('typescript', 'jsx');
            break;
        // Adding .jsx extension by default because it doesn't affect other syntax features
        // (unlike .tsx) and because people are seem to use it with regular file extensions
        // (e.g. .js) see https://github.com/dotansimha/graphql-code-generator/issues/1967
        case '.js':
            plugins.push.apply(plugins, tslib.__spread(['jsx'], dynamicFlowPlugins));
            break;
        case '.jsx':
            plugins.push.apply(plugins, tslib.__spread(['jsx'], dynamicFlowPlugins));
            break;
        case '.flow.js':
            plugins.push.apply(plugins, tslib.__spread(['jsx'], flowPlugins));
            break;
        case '.flow.jsx':
            plugins.push.apply(plugins, tslib.__spread(['jsx'], flowPlugins));
            break;
        case '.flow':
            plugins.push.apply(plugins, tslib.__spread(['jsx'], flowPlugins));
            break;
        case '.vue':
            plugins.push('typescript', 'vue');
            break;
        default:
            plugins.push.apply(plugins, tslib.__spread(['jsx'], dynamicFlowPlugins));
            break;
    }
    // The _options filed will be used to retrieve the original options.
    // Useful when we wanna get not config related options later on
    return {
        sourceType: 'module',
        plugins: plugins,
        allowUndeclaredExports: true,
    };
}

// Will use the shortest indention as an axis
var freeText = function (text, skipIndentation) {
    if (skipIndentation === void 0) { skipIndentation = false; }
    if (text instanceof Array) {
        text = text.join('');
    }
    // This will allow inline text generation with external functions, same as ctrl+shift+c
    // As long as we surround the inline text with ==>text<==
    text = text.replace(/( *)==>((?:.|\n)*?)<==/g, function (_match, baseIndent, content) {
        return content
            .split('\n')
            .map(function (line) { return "" + baseIndent + line; })
            .join('\n');
    });
    if (skipIndentation) {
        return text;
    }
    var lines = text.split('\n');
    var minIndent = lines
        .filter(function (line) { return line.trim(); })
        .reduce(function (minIndent, line) {
        var currIndent = line.match(/^ */)[0].length;
        return currIndent < minIndent ? currIndent : minIndent;
    }, Infinity);
    return lines
        .map(function (line) { return line.slice(minIndent); })
        .join('\n')
        .trim()
        .replace(/\n +\n/g, '\n\n');
};

var defaults = {
    modules: [
        {
            name: 'graphql-tag',
        },
        {
            name: 'graphql-tag.macro',
        },
        {
            name: '@apollo/client',
            identifier: 'gql',
        },
        {
            name: '@apollo/client/core',
            identifier: 'gql',
        },
        {
            name: 'apollo-angular',
            identifier: 'gql',
        },
        {
            name: 'gatsby',
            identifier: 'graphql',
        },
        {
            name: 'apollo-server-express',
            identifier: 'gql',
        },
        {
            name: 'apollo-server',
            identifier: 'gql',
        },
        {
            name: 'react-relay',
            identifier: 'graphql',
        },
        {
            name: 'apollo-boost',
            identifier: 'gql',
        },
        {
            name: 'apollo-server-koa',
            identifier: 'gql',
        },
        {
            name: 'apollo-server-hapi',
            identifier: 'gql',
        },
        {
            name: 'apollo-server-fastify',
            identifier: 'gql',
        },
        {
            name: ' apollo-server-lambda',
            identifier: 'gql',
        },
        {
            name: 'apollo-server-micro',
            identifier: 'gql',
        },
        {
            name: 'apollo-server-azure-functions',
            identifier: 'gql',
        },
        {
            name: 'apollo-server-cloud-functions',
            identifier: 'gql',
        },
        {
            name: 'apollo-server-cloudflare',
            identifier: 'gql',
        },
        {
            name: 'graphql.macro',
            identifier: 'gql',
        },
    ],
    gqlMagicComment: 'graphql',
    globalGqlIdentifierName: ['gql', 'graphql'],
};
const createVisitor = (function (code, out, options) {
    if (options === void 0) { options = {}; }
    // Apply defaults to options
    var _a = tslib.__assign(tslib.__assign({}, defaults), options), modules = _a.modules, globalGqlIdentifierName = _a.globalGqlIdentifierName, gqlMagicComment = _a.gqlMagicComment;
    // Prevent case related potential errors
    gqlMagicComment = gqlMagicComment.toLowerCase();
    // normalize `name` and `identifier` values
    modules = modules.map(function (mod) {
        return {
            name: mod.name,
            identifier: mod.identifier && mod.identifier.toLowerCase(),
        };
    });
    globalGqlIdentifierName = utils.asArray(globalGqlIdentifierName).map(function (s) { return s.toLowerCase(); });
    // Keep imported identifiers
    // import gql from 'graphql-tag' -> gql
    // import { graphql } from 'gatsby' -> graphql
    // Will result with ['gql', 'graphql']
    var definedIdentifierNames = [];
    // Will accumulate all template literals
    var gqlTemplateLiterals = [];
    // Check if package is registered
    function isValidPackage(name) {
        return modules.some(function (pkg) { return pkg.name && name && pkg.name.toLowerCase() === name.toLowerCase(); });
    }
    // Check if identifier is defined and imported from registered packages
    function isValidIdentifier(name) {
        return definedIdentifierNames.some(function (id) { return id === name; }) || globalGqlIdentifierName.includes(name);
    }
    var pluckStringFromFile = function (_a) {
        var start = _a.start, end = _a.end;
        return freeText(code
            // Slice quotes
            .slice(start + 1, end - 1)
            // Erase string interpolations as we gonna export everything as a single
            // string anyways
            .replace(/\$\{[^}]*\}/g, '')
            .split('\\`')
            .join('`'), options.skipIndent);
    };
    // Push all template literals leaded by graphql magic comment
    // e.g. /* GraphQL */ `query myQuery {}` -> query myQuery {}
    var pluckMagicTemplateLiteral = function (node, takeExpression) {
        if (takeExpression === void 0) { takeExpression = false; }
        var leadingComments = node.leadingComments;
        if (!leadingComments) {
            return;
        }
        if (!leadingComments.length) {
            return;
        }
        var leadingComment = leadingComments[leadingComments.length - 1];
        var leadingCommentValue = leadingComment.value.trim().toLowerCase();
        if (leadingCommentValue !== gqlMagicComment) {
            return;
        }
        var nodeToUse = takeExpression ? node.expression : node;
        var gqlTemplateLiteral = pluckStringFromFile(nodeToUse);
        if (gqlTemplateLiteral) {
            gqlTemplateLiterals.push({
                content: gqlTemplateLiteral,
                loc: node.loc,
                end: node.end,
                start: node.start,
            });
        }
    };
    return {
        CallExpression: {
            enter: function (path) {
                // Find the identifier name used from graphql-tag, commonJS
                // e.g. import gql from 'graphql-tag' -> gql
                if (path.node.callee.name === 'require' && isValidPackage(path.node.arguments[0].value)) {
                    if (!types.isVariableDeclarator(path.parent)) {
                        return;
                    }
                    if (!types.isIdentifier(path.parent.id)) {
                        return;
                    }
                    definedIdentifierNames.push(path.parent.id.name);
                    return;
                }
                var arg0 = path.node.arguments[0];
                // Push strings template literals to gql calls
                // e.g. gql(`query myQuery {}`) -> query myQuery {}
                if (types.isIdentifier(path.node.callee) && isValidIdentifier(path.node.callee.name) && types.isTemplateLiteral(arg0)) {
                    var gqlTemplateLiteral = pluckStringFromFile(arg0);
                    // If the entire template was made out of interpolations it should be an empty
                    // string by now and thus should be ignored
                    if (gqlTemplateLiteral) {
                        gqlTemplateLiterals.push({
                            content: gqlTemplateLiteral,
                            loc: arg0.loc,
                            end: arg0.end,
                            start: arg0.start,
                        });
                    }
                }
            },
        },
        ImportDeclaration: {
            enter: function (path) {
                // Find the identifier name used from graphql-tag, es6
                // e.g. import gql from 'graphql-tag' -> gql
                if (!isValidPackage(path.node.source.value)) {
                    return;
                }
                var moduleNode = modules.find(function (pkg) { return pkg.name.toLowerCase() === path.node.source.value.toLowerCase(); });
                var gqlImportSpecifier = path.node.specifiers.find(function (importSpecifier) {
                    // When it's a default import and registered package has no named identifier
                    if (types.isImportDefaultSpecifier(importSpecifier) && !moduleNode.identifier) {
                        return true;
                    }
                    // When it's a named import that matches registered package's identifier
                    if (types.isImportSpecifier(importSpecifier) &&
                        'name' in importSpecifier.imported &&
                        importSpecifier.imported.name === moduleNode.identifier) {
                        return true;
                    }
                    return false;
                });
                if (!gqlImportSpecifier) {
                    return;
                }
                definedIdentifierNames.push(gqlImportSpecifier.local.name);
            },
        },
        ExpressionStatement: {
            exit: function (path) {
                // Push all template literals leaded by graphql magic comment
                // e.g. /* GraphQL */ `query myQuery {}` -> query myQuery {}
                if (!types.isTemplateLiteral(path.node.expression)) {
                    return;
                }
                pluckMagicTemplateLiteral(path.node, true);
            },
        },
        TemplateLiteral: {
            exit: function (path) {
                pluckMagicTemplateLiteral(path.node);
            },
        },
        TaggedTemplateExpression: {
            exit: function (path) {
                // Push all template literals provided to the found identifier name
                // e.g. gql `query myQuery {}` -> query myQuery {}
                if (!types.isIdentifier(path.node.tag) || !isValidIdentifier(path.node.tag.name)) {
                    return;
                }
                var gqlTemplateLiteral = pluckStringFromFile(path.node.quasi);
                if (gqlTemplateLiteral) {
                    gqlTemplateLiterals.push({
                        content: gqlTemplateLiteral,
                        end: path.node.quasi.end,
                        start: path.node.quasi.start,
                        loc: path.node.quasi.loc,
                    });
                }
            },
        },
        exit: function () {
            out.returnValue = gqlTemplateLiterals;
        },
    };
});

var supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.flow', '.flow.js', '.flow.jsx', '.vue'];
// tslint:disable-next-line: no-implicit-dependencies
function parseWithVue(vueTemplateCompiler, fileData) {
    var descriptor = vueTemplateCompiler.parse(fileData).descriptor;
    return descriptor.script || descriptor.scriptSetup
        ? vueTemplateCompiler.compileScript(descriptor, { id: '' }).content
        : '';
}
/**
 * Asynchronously plucks GraphQL template literals from a single file.
 *
 * Supported file extensions include: `.js`, `.jsx`, `.ts`, `.tsx`, `.flow`, `.flow.js`, `.flow.jsx`, `.vue`
 *
 * @param filePath Path to the file containing the code. Required to detect the file type
 * @param code The contents of the file being parsed.
 * @param options Additional options for determining how a file is parsed.
 */
var gqlPluckFromCodeString = function (filePath, code, options) {
    if (options === void 0) { options = {}; }
    return tslib.__awaiter(void 0, void 0, void 0, function () {
        var fileExt;
        return tslib.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    validate({ code: code, options: options });
                    fileExt = extractExtension(filePath);
                    if (!(fileExt === '.vue')) return [3 /*break*/, 2];
                    return [4 /*yield*/, pluckVueFileScript(code)];
                case 1:
                    code = _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, parseCode({ code: code, filePath: filePath, options: options })
                        .map(function (t) { return t.content; })
                        .join('\n\n')];
            }
        });
    });
};
/**
 * Synchronously plucks GraphQL template literals from a single file
 *
 * Supported file extensions include: `.js`, `.jsx`, `.ts`, `.tsx`, `.flow`, `.flow.js`, `.flow.jsx`, `.vue`
 *
 * @param filePath Path to the file containing the code. Required to detect the file type
 * @param code The contents of the file being parsed.
 * @param options Additional options for determining how a file is parsed.
 */
var gqlPluckFromCodeStringSync = function (filePath, code, options) {
    if (options === void 0) { options = {}; }
    validate({ code: code, options: options });
    var fileExt = extractExtension(filePath);
    if (fileExt === '.vue') {
        code = pluckVueFileScriptSync(code);
    }
    return parseCode({ code: code, filePath: filePath, options: options })
        .map(function (t) { return t.content; })
        .join('\n\n');
};
function parseCode(_a) {
    var code = _a.code, filePath = _a.filePath, options = _a.options;
    var out = { returnValue: null };
    var ast = parser.parse(code, generateConfig(filePath, code));
    var visitor = createVisitor(code, out, options);
    traverse(ast, visitor);
    return out.returnValue || [];
}
function validate(_a) {
    var code = _a.code, options = _a.options;
    if (typeof code !== 'string') {
        throw TypeError('Provided code must be a string');
    }
    if (!(options instanceof Object)) {
        throw TypeError("Options arg must be an object");
    }
}
function extractExtension(filePath) {
    var fileExt = getExtNameFromFilePath(filePath);
    if (fileExt) {
        if (!supportedExtensions.includes(fileExt)) {
            throw TypeError("Provided file type must be one of " + supportedExtensions.join(', ') + " ");
        }
    }
    return fileExt;
}
var MissingVueTemplateCompilerError = new Error(freeText("\n    GraphQL template literals cannot be plucked from a Vue template code without having the \"vue-template-compiler\" package installed.\n    Please install it and try again.\n\n    Via NPM:\n\n        $ npm install @vue/compiler-sfc\n\n    Via Yarn:\n\n        $ yarn add @vue/compiler-sfc\n  "));
function pluckVueFileScript(fileData) {
    return tslib.__awaiter(this, void 0, void 0, function () {
        var vueTemplateCompiler, e_1;
        return tslib.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, new Promise(function (resolve) { resolve(_interopNamespace(require('@vue/compiler-sfc'))); })];
                case 1:
                    // tslint:disable-next-line: no-implicit-dependencies
                    vueTemplateCompiler = _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    throw MissingVueTemplateCompilerError;
                case 3: return [2 /*return*/, parseWithVue(vueTemplateCompiler, fileData)];
            }
        });
    });
}
function pluckVueFileScriptSync(fileData) {
    // tslint:disable-next-line: no-implicit-dependencies
    var vueTemplateCompiler;
    try {
        // tslint:disable-next-line: no-implicit-dependencies
        vueTemplateCompiler = require('@vue/compiler-sfc');
    }
    catch (e) {
        throw MissingVueTemplateCompilerError;
    }
    return parseWithVue(vueTemplateCompiler, fileData);
}

exports.gqlPluckFromCodeString = gqlPluckFromCodeString;
exports.gqlPluckFromCodeStringSync = gqlPluckFromCodeStringSync;
exports.parseCode = parseCode;
//# sourceMappingURL=index.cjs.js.map
