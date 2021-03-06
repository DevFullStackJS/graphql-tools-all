'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const graphql = require('graphql');
const utils = require('@graphql-tools/utils/es5');
const schema = require('@graphql-tools/schema/es5');
const delegate = require('@graphql-tools/delegate/es5');
const tslib = require('tslib');
const wrap = require('@graphql-tools/wrap/es5');
const merge = require('@graphql-tools/merge/es5');
const batchDelegate = require('@graphql-tools/batch-delegate/es5');

var backcompatOptions = { commentDescriptions: true };
function typeFromAST(node) {
    switch (node.kind) {
        case graphql.Kind.OBJECT_TYPE_DEFINITION:
            return makeObjectType(node);
        case graphql.Kind.INTERFACE_TYPE_DEFINITION:
            return makeInterfaceType(node);
        case graphql.Kind.ENUM_TYPE_DEFINITION:
            return makeEnumType(node);
        case graphql.Kind.UNION_TYPE_DEFINITION:
            return makeUnionType(node);
        case graphql.Kind.SCALAR_TYPE_DEFINITION:
            return makeScalarType(node);
        case graphql.Kind.INPUT_OBJECT_TYPE_DEFINITION:
            return makeInputObjectType(node);
        case graphql.Kind.DIRECTIVE_DEFINITION:
            return makeDirective(node);
        default:
            return null;
    }
}
function makeObjectType(node) {
    var config = {
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        interfaces: function () { return node.interfaces.map(function (iface) { return utils.createNamedStub(iface.name.value, 'interface'); }); },
        fields: function () { return makeFields(node.fields); },
        astNode: node,
    };
    return new graphql.GraphQLObjectType(config);
}
function makeInterfaceType(node) {
    var _a;
    var config = {
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        interfaces: (_a = node.interfaces) === null || _a === void 0 ? void 0 : _a.map(function (iface) {
            return utils.createNamedStub(iface.name.value, 'interface');
        }),
        fields: function () { return makeFields(node.fields); },
        astNode: node,
    };
    return new graphql.GraphQLInterfaceType(config);
}
function makeEnumType(node) {
    var values = node.values.reduce(function (prev, value) {
        var _a;
        return (tslib.__assign(tslib.__assign({}, prev), (_a = {}, _a[value.name.value] = {
            description: getDescription(value, backcompatOptions),
            deprecationReason: getDeprecationReason(value),
            astNode: value,
        }, _a)));
    }, {});
    return new graphql.GraphQLEnumType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        values: values,
        astNode: node,
    });
}
function makeUnionType(node) {
    return new graphql.GraphQLUnionType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        types: function () { return node.types.map(function (type) { return utils.createNamedStub(type.name.value, 'object'); }); },
        astNode: node,
    });
}
function makeScalarType(node) {
    return new graphql.GraphQLScalarType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        astNode: node,
        // TODO: serialize default property setting can be dropped once
        // upstream graphql-js TypeScript typings are updated, likely in v16
        serialize: function (value) { return value; },
    });
}
function makeInputObjectType(node) {
    return new graphql.GraphQLInputObjectType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        fields: function () { return makeValues(node.fields); },
        astNode: node,
    });
}
function makeFields(nodes) {
    return nodes.reduce(function (prev, node) {
        var _a;
        return (tslib.__assign(tslib.__assign({}, prev), (_a = {}, _a[node.name.value] = {
            type: utils.createStub(node.type, 'output'),
            description: getDescription(node, backcompatOptions),
            args: makeValues(node.arguments),
            deprecationReason: getDeprecationReason(node),
            astNode: node,
        }, _a)));
    }, {});
}
function makeValues(nodes) {
    return nodes.reduce(function (prev, node) {
        var _a;
        return (tslib.__assign(tslib.__assign({}, prev), (_a = {}, _a[node.name.value] = {
            type: utils.createStub(node.type, 'input'),
            defaultValue: node.defaultValue !== undefined ? graphql.valueFromASTUntyped(node.defaultValue) : undefined,
            description: getDescription(node, backcompatOptions),
            astNode: node,
        }, _a)));
    }, {});
}
function makeDirective(node) {
    var locations = [];
    node.locations.forEach(function (location) {
        if (location.value in graphql.DirectiveLocation) {
            locations.push(location.value);
        }
    });
    return new graphql.GraphQLDirective({
        name: node.name.value,
        description: node.description != null ? node.description.value : null,
        locations: locations,
        isRepeatable: node.repeatable,
        args: makeValues(node.arguments),
        astNode: node,
    });
}
// graphql < v13 does not export getDescription
function getDescription(node, options) {
    if (node.description != null) {
        return node.description.value;
    }
    if (options.commentDescriptions) {
        var rawValue = getLeadingCommentBlock(node);
        if (rawValue !== undefined) {
            return dedentBlockStringValue("\n" + rawValue);
        }
    }
}
function getLeadingCommentBlock(node) {
    var loc = node.loc;
    if (!loc) {
        return;
    }
    var comments = [];
    var token = loc.startToken.prev;
    while (token != null &&
        token.kind === graphql.TokenKind.COMMENT &&
        token.next != null &&
        token.prev != null &&
        token.line + 1 === token.next.line &&
        token.line !== token.prev.line) {
        var value = String(token.value);
        comments.push(value);
        token = token.prev;
    }
    return comments.length > 0 ? comments.reverse().join('\n') : undefined;
}
function dedentBlockStringValue(rawString) {
    // Expand a block string's raw value into independent lines.
    var lines = rawString.split(/\r\n|[\n\r]/g);
    // Remove common indentation from all lines but first.
    var commonIndent = getBlockStringIndentation(lines);
    if (commonIndent !== 0) {
        for (var i = 1; i < lines.length; i++) {
            lines[i] = lines[i].slice(commonIndent);
        }
    }
    // Remove leading and trailing blank lines.
    while (lines.length > 0 && isBlank(lines[0])) {
        lines.shift();
    }
    while (lines.length > 0 && isBlank(lines[lines.length - 1])) {
        lines.pop();
    }
    // Return a string of the lines joined with U+000A.
    return lines.join('\n');
}
/**
 * @internal
 */
function getBlockStringIndentation(lines) {
    var commonIndent = null;
    for (var i = 1; i < lines.length; i++) {
        var line = lines[i];
        var indent = leadingWhitespace(line);
        if (indent === line.length) {
            continue; // skip empty lines
        }
        if (commonIndent === null || indent < commonIndent) {
            commonIndent = indent;
            if (commonIndent === 0) {
                break;
            }
        }
    }
    return commonIndent === null ? 0 : commonIndent;
}
function leadingWhitespace(str) {
    var i = 0;
    while (i < str.length && (str[i] === ' ' || str[i] === '\t')) {
        i++;
    }
    return i;
}
function isBlank(str) {
    return leadingWhitespace(str) === str.length;
}
function getDeprecationReason(node) {
    var deprecated = graphql.getDirectiveValues(graphql.GraphQLDeprecatedDirective, node);
    return deprecated === null || deprecated === void 0 ? void 0 : deprecated.reason;
}

function mergeCandidates(typeName, candidates, typeMergingOptions) {
    var initialCandidateType = candidates[0].type;
    if (candidates.some(function (candidate) { return candidate.type.constructor !== initialCandidateType.constructor; })) {
        throw new Error("Cannot merge different type categories into common type " + typeName + ".");
    }
    if (graphql.isObjectType(initialCandidateType)) {
        return mergeObjectTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else if (graphql.isInputObjectType(initialCandidateType)) {
        return mergeInputObjectTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else if (graphql.isInterfaceType(initialCandidateType)) {
        return mergeInterfaceTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else if (graphql.isUnionType(initialCandidateType)) {
        return mergeUnionTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else if (graphql.isEnumType(initialCandidateType)) {
        return mergeEnumTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else if (graphql.isScalarType(initialCandidateType)) {
        return mergeScalarTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else {
        // not reachable.
        throw new Error("Type " + typeName + " has unknown GraphQL type.");
    }
}
function mergeObjectTypeCandidates(typeName, candidates, typeMergingOptions) {
    var description = mergeTypeDescriptions(candidates, typeMergingOptions);
    var fields = fieldConfigMapFromTypeCandidates(candidates, typeMergingOptions);
    var typeConfigs = candidates.map(function (candidate) { return candidate.type.toConfig(); });
    var interfaceMap = typeConfigs
        .map(function (typeConfig) { return typeConfig.interfaces; })
        .reduce(function (acc, interfaces) {
        if (interfaces != null) {
            interfaces.forEach(function (iface) {
                acc[iface.name] = iface;
            });
        }
        return acc;
    }, Object.create(null));
    var interfaces = Object.keys(interfaceMap).map(function (interfaceName) { return interfaceMap[interfaceName]; });
    var astNodes = pluck('astNode', candidates);
    var astNode = astNodes
        .slice(1)
        .reduce(function (acc, astNode) { return merge.mergeType(astNode, acc); }, astNodes[0]);
    var extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    var extensions = Object.assign.apply(Object, tslib.__spread([{}], pluck('extensions', candidates)));
    var typeConfig = {
        name: typeName,
        description: description,
        fields: fields,
        interfaces: interfaces,
        astNode: astNode,
        extensionASTNodes: extensionASTNodes,
        extensions: extensions,
    };
    return new graphql.GraphQLObjectType(typeConfig);
}
function mergeInputObjectTypeCandidates(typeName, candidates, typeMergingOptions) {
    var description = mergeTypeDescriptions(candidates, typeMergingOptions);
    var fields = inputFieldConfigMapFromTypeCandidates(candidates, typeMergingOptions);
    var astNodes = pluck('astNode', candidates);
    var astNode = astNodes
        .slice(1)
        .reduce(function (acc, astNode) { return merge.mergeInputType(astNode, acc); }, astNodes[0]);
    var extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    var extensions = Object.assign.apply(Object, tslib.__spread([{}], pluck('extensions', candidates)));
    var typeConfig = {
        name: typeName,
        description: description,
        fields: fields,
        astNode: astNode,
        extensionASTNodes: extensionASTNodes,
        extensions: extensions,
    };
    return new graphql.GraphQLInputObjectType(typeConfig);
}
function pluck(typeProperty, candidates) {
    return candidates.map(function (candidate) { return candidate.type[typeProperty]; }).filter(function (value) { return value != null; });
}
function mergeInterfaceTypeCandidates(typeName, candidates, typeMergingOptions) {
    var description = mergeTypeDescriptions(candidates, typeMergingOptions);
    var fields = fieldConfigMapFromTypeCandidates(candidates, typeMergingOptions);
    var typeConfigs = candidates.map(function (candidate) { return candidate.type.toConfig(); });
    var interfaceMap = typeConfigs
        .map(function (typeConfig) { return typeConfig.interfaces; })
        .reduce(function (acc, interfaces) {
        if (interfaces != null) {
            interfaces.forEach(function (iface) {
                acc[iface.name] = iface;
            });
        }
        return acc;
    }, Object.create(null));
    var interfaces = Object.keys(interfaceMap).map(function (interfaceName) { return interfaceMap[interfaceName]; });
    var astNodes = pluck('astNode', candidates);
    var astNode = astNodes
        .slice(1)
        .reduce(function (acc, astNode) { return merge.mergeInterface(astNode, acc, {}); }, astNodes[0]);
    var extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    var extensions = Object.assign.apply(Object, tslib.__spread([{}], pluck('extensions', candidates)));
    var typeConfig = {
        name: typeName,
        description: description,
        fields: fields,
        interfaces: interfaces,
        astNode: astNode,
        extensionASTNodes: extensionASTNodes,
        extensions: extensions,
    };
    return new graphql.GraphQLInterfaceType(typeConfig);
}
function mergeUnionTypeCandidates(typeName, candidates, typeMergingOptions) {
    var description = mergeTypeDescriptions(candidates, typeMergingOptions);
    var typeConfigs = candidates.map(function (candidate) { return candidate.type.toConfig(); });
    var typeMap = typeConfigs.reduce(function (acc, typeConfig) {
        typeConfig.types.forEach(function (type) {
            acc[type.name] = type;
        });
        return acc;
    }, Object.create(null));
    var types = Object.keys(typeMap).map(function (typeName) { return typeMap[typeName]; });
    var astNodes = pluck('astNode', candidates);
    var astNode = astNodes
        .slice(1)
        .reduce(function (acc, astNode) { return merge.mergeUnion(astNode, acc); }, astNodes[0]);
    var extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    var extensions = Object.assign.apply(Object, tslib.__spread([{}], pluck('extensions', candidates)));
    var typeConfig = {
        name: typeName,
        description: description,
        types: types,
        astNode: astNode,
        extensionASTNodes: extensionASTNodes,
        extensions: extensions,
    };
    return new graphql.GraphQLUnionType(typeConfig);
}
function mergeEnumTypeCandidates(typeName, candidates, typeMergingOptions) {
    var description = mergeTypeDescriptions(candidates, typeMergingOptions);
    var typeConfigs = candidates.map(function (candidate) { return candidate.type.toConfig(); });
    var values = typeConfigs.reduce(function (acc, typeConfig) { return (tslib.__assign(tslib.__assign({}, acc), typeConfig.values)); }, {});
    var astNodes = pluck('astNode', candidates);
    var astNode = astNodes
        .slice(1)
        .reduce(function (acc, astNode) { return merge.mergeEnum(astNode, acc); }, astNodes[0]);
    var extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    var extensions = Object.assign.apply(Object, tslib.__spread([{}], pluck('extensions', candidates)));
    var typeConfig = {
        name: typeName,
        description: description,
        values: values,
        astNode: astNode,
        extensionASTNodes: extensionASTNodes,
        extensions: extensions,
    };
    return new graphql.GraphQLEnumType(typeConfig);
}
function mergeScalarTypeCandidates(typeName, candidates, typeMergingOptions) {
    var description = mergeTypeDescriptions(candidates, typeMergingOptions);
    var serializeFns = pluck('serialize', candidates);
    var serialize = serializeFns[serializeFns.length - 1];
    var parseValueFns = pluck('parseValue', candidates);
    var parseValue = parseValueFns[parseValueFns.length - 1];
    var parseLiteralFns = pluck('parseLiteral', candidates);
    var parseLiteral = parseLiteralFns[parseLiteralFns.length - 1];
    var astNodes = pluck('astNode', candidates);
    var astNode = astNodes
        .slice(1)
        .reduce(function (acc, astNode) { return merge.mergeScalar(acc, astNode); }, astNodes[0]);
    var extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    var extensions = Object.assign.apply(Object, tslib.__spread([{}], pluck('extensions', candidates)));
    var typeConfig = {
        name: typeName,
        description: description,
        serialize: serialize,
        parseValue: parseValue,
        parseLiteral: parseLiteral,
        astNode: astNode,
        extensionASTNodes: extensionASTNodes,
        extensions: extensions,
    };
    return new graphql.GraphQLScalarType(typeConfig);
}
function mergeTypeDescriptions(candidates, typeMergingOptions) {
    var _a;
    var typeDescriptionsMerger = (_a = typeMergingOptions === null || typeMergingOptions === void 0 ? void 0 : typeMergingOptions.typeDescriptionsMerger) !== null && _a !== void 0 ? _a : defaultTypeDescriptionMerger;
    return typeDescriptionsMerger(candidates);
}
function defaultTypeDescriptionMerger(candidates) {
    return candidates[candidates.length - 1].type.description;
}
function fieldConfigMapFromTypeCandidates(candidates, typeMergingOptions) {
    var fieldConfigCandidatesMap = Object.create(null);
    candidates.forEach(function (candidate) {
        var fieldMap = candidate.type.getFields();
        Object.keys(fieldMap).forEach(function (fieldName) {
            var fieldConfigCandidate = {
                fieldConfig: utils.fieldToFieldConfig(fieldMap[fieldName]),
                fieldName: fieldName,
                type: candidate.type,
                subschema: candidate.subschema,
                transformedSubschema: candidate.transformedSubschema,
            };
            if (fieldName in fieldConfigCandidatesMap) {
                fieldConfigCandidatesMap[fieldName].push(fieldConfigCandidate);
            }
            else {
                fieldConfigCandidatesMap[fieldName] = [fieldConfigCandidate];
            }
        });
    });
    var fieldConfigMap = Object.create(null);
    Object.keys(fieldConfigCandidatesMap).forEach(function (fieldName) {
        fieldConfigMap[fieldName] = mergeFieldConfigs(fieldConfigCandidatesMap[fieldName], typeMergingOptions);
    });
    return fieldConfigMap;
}
function mergeFieldConfigs(candidates, typeMergingOptions) {
    var _a;
    var fieldConfigMerger = (_a = typeMergingOptions === null || typeMergingOptions === void 0 ? void 0 : typeMergingOptions.fieldConfigMerger) !== null && _a !== void 0 ? _a : defaultFieldConfigMerger;
    return fieldConfigMerger(candidates);
}
function defaultFieldConfigMerger(candidates) {
    return candidates[candidates.length - 1].fieldConfig;
}
function inputFieldConfigMapFromTypeCandidates(candidates, typeMergingOptions) {
    var inputFieldConfigCandidatesMap = Object.create(null);
    candidates.forEach(function (candidate) {
        var inputFieldMap = candidate.type.getFields();
        Object.keys(inputFieldMap).forEach(function (fieldName) {
            var inputFieldConfigCandidate = {
                inputFieldConfig: utils.inputFieldToFieldConfig(inputFieldMap[fieldName]),
                fieldName: fieldName,
                type: candidate.type,
                subschema: candidate.subschema,
                transformedSubschema: candidate.transformedSubschema,
            };
            if (fieldName in inputFieldConfigCandidatesMap) {
                inputFieldConfigCandidatesMap[fieldName].push(inputFieldConfigCandidate);
            }
            else {
                inputFieldConfigCandidatesMap[fieldName] = [inputFieldConfigCandidate];
            }
        });
    });
    var inputFieldConfigMap = Object.create(null);
    Object.keys(inputFieldConfigCandidatesMap).forEach(function (fieldName) {
        inputFieldConfigMap[fieldName] = mergeInputFieldConfigs(inputFieldConfigCandidatesMap[fieldName], typeMergingOptions);
    });
    return inputFieldConfigMap;
}
function mergeInputFieldConfigs(candidates, typeMergingOptions) {
    var _a;
    var inputFieldConfigMerger = (_a = typeMergingOptions === null || typeMergingOptions === void 0 ? void 0 : typeMergingOptions.inputFieldConfigMerger) !== null && _a !== void 0 ? _a : defaultInputFieldConfigMerger;
    return inputFieldConfigMerger(candidates);
}
function defaultInputFieldConfigMerger(candidates) {
    return candidates[candidates.length - 1].inputFieldConfig;
}

function extractDefinitions(ast) {
    var typeDefinitions = [];
    var directiveDefs = [];
    var schemaDefs = [];
    var schemaExtensions = [];
    var extensionDefs = [];
    ast.definitions.forEach(function (def) {
        switch (def.kind) {
            case graphql.Kind.OBJECT_TYPE_DEFINITION:
            case graphql.Kind.INTERFACE_TYPE_DEFINITION:
            case graphql.Kind.INPUT_OBJECT_TYPE_DEFINITION:
            case graphql.Kind.UNION_TYPE_DEFINITION:
            case graphql.Kind.ENUM_TYPE_DEFINITION:
            case graphql.Kind.SCALAR_TYPE_DEFINITION:
                typeDefinitions.push(def);
                break;
            case graphql.Kind.DIRECTIVE_DEFINITION:
                directiveDefs.push(def);
                break;
            case graphql.Kind.SCHEMA_DEFINITION:
                schemaDefs.push(def);
                break;
            case graphql.Kind.SCHEMA_EXTENSION:
                schemaExtensions.push(def);
                break;
            case graphql.Kind.OBJECT_TYPE_EXTENSION:
            case graphql.Kind.INTERFACE_TYPE_EXTENSION:
            case graphql.Kind.INPUT_OBJECT_TYPE_EXTENSION:
            case graphql.Kind.UNION_TYPE_EXTENSION:
            case graphql.Kind.ENUM_TYPE_EXTENSION:
            case graphql.Kind.SCALAR_TYPE_EXTENSION:
                extensionDefs.push(def);
                break;
        }
    });
    return {
        typeDefinitions: typeDefinitions,
        directiveDefs: directiveDefs,
        schemaDefs: schemaDefs,
        schemaExtensions: schemaExtensions,
        extensionDefs: extensionDefs,
    };
}

function buildTypeCandidates(_a) {
    var subschemas = _a.subschemas, originalSubschemaMap = _a.originalSubschemaMap, types = _a.types, typeDefs = _a.typeDefs, parseOptions = _a.parseOptions, extensions = _a.extensions, directiveMap = _a.directiveMap, schemaDefs = _a.schemaDefs, operationTypeNames = _a.operationTypeNames, mergeDirectives = _a.mergeDirectives;
    var typeCandidates = Object.create(null);
    var schemaDef;
    var schemaExtensions = [];
    var document;
    var extraction;
    if ((typeDefs && !Array.isArray(typeDefs)) || (Array.isArray(typeDefs) && typeDefs.length)) {
        document = schema.buildDocumentFromTypeDefinitions(typeDefs, parseOptions);
        extraction = extractDefinitions(document);
        schemaDef = extraction.schemaDefs[0];
        schemaExtensions = schemaExtensions.concat(extraction.schemaExtensions);
    }
    schemaDefs.schemaDef = schemaDef;
    schemaDefs.schemaExtensions = schemaExtensions;
    setOperationTypeNames(schemaDefs, operationTypeNames);
    subschemas.forEach(function (subschema) {
        var schema = wrap.wrapSchema(subschema);
        var operationTypes = {
            query: schema.getQueryType(),
            mutation: schema.getMutationType(),
            subscription: schema.getSubscriptionType(),
        };
        Object.keys(operationTypes).forEach(function (operationType) {
            if (operationTypes[operationType] != null) {
                addTypeCandidate(typeCandidates, operationTypeNames[operationType], {
                    type: operationTypes[operationType],
                    subschema: originalSubschemaMap.get(subschema),
                    transformedSubschema: subschema,
                });
            }
        });
        if (mergeDirectives) {
            schema.getDirectives().forEach(function (directive) {
                directiveMap[directive.name] = directive;
            });
        }
        var originalTypeMap = schema.getTypeMap();
        Object.keys(originalTypeMap).forEach(function (typeName) {
            var type = originalTypeMap[typeName];
            if (graphql.isNamedType(type) &&
                graphql.getNamedType(type).name.slice(0, 2) !== '__' &&
                type !== operationTypes.query &&
                type !== operationTypes.mutation &&
                type !== operationTypes.subscription) {
                addTypeCandidate(typeCandidates, type.name, {
                    type: type,
                    subschema: originalSubschemaMap.get(subschema),
                    transformedSubschema: subschema,
                });
            }
        });
    });
    if (document !== undefined) {
        extraction.typeDefinitions.forEach(function (def) {
            var type = typeFromAST(def);
            if (type != null) {
                addTypeCandidate(typeCandidates, type.name, { type: type });
            }
        });
        extraction.directiveDefs.forEach(function (def) {
            var directive = typeFromAST(def);
            directiveMap[directive.name] = directive;
        });
        if (extraction.extensionDefs.length > 0) {
            extensions.push(tslib.__assign(tslib.__assign({}, document), { definitions: extraction.extensionDefs }));
        }
    }
    types.forEach(function (type) { return addTypeCandidate(typeCandidates, type.name, { type: type }); });
    return typeCandidates;
}
function setOperationTypeNames(_a, operationTypeNames) {
    var schemaDef = _a.schemaDef, schemaExtensions = _a.schemaExtensions;
    var allNodes = schemaExtensions.slice();
    if (schemaDef != null) {
        allNodes.unshift(schemaDef);
    }
    allNodes.forEach(function (node) {
        if (node.operationTypes != null) {
            node.operationTypes.forEach(function (operationType) {
                operationTypeNames[operationType.operation] = operationType.type.name.value;
            });
        }
    });
}
function addTypeCandidate(typeCandidates, name, typeCandidate) {
    if (!(name in typeCandidates)) {
        typeCandidates[name] = [];
    }
    typeCandidates[name].push(typeCandidate);
}
function buildTypes(_a) {
    var typeCandidates = _a.typeCandidates, directives = _a.directives, stitchingInfo = _a.stitchingInfo, operationTypeNames = _a.operationTypeNames, onTypeConflict = _a.onTypeConflict, mergeTypes = _a.mergeTypes, typeMergingOptions = _a.typeMergingOptions;
    var typeMap = Object.create(null);
    Object.keys(typeCandidates).forEach(function (typeName) {
        if (typeName === operationTypeNames.query ||
            typeName === operationTypeNames.mutation ||
            typeName === operationTypeNames.subscription ||
            (mergeTypes === true && !typeCandidates[typeName].some(function (candidate) { return graphql.isSpecifiedScalarType(candidate.type); })) ||
            (typeof mergeTypes === 'function' && mergeTypes(typeCandidates[typeName], typeName)) ||
            (Array.isArray(mergeTypes) && mergeTypes.includes(typeName)) ||
            (stitchingInfo != null && typeName in stitchingInfo.mergedTypes)) {
            typeMap[typeName] = mergeCandidates(typeName, typeCandidates[typeName], typeMergingOptions);
        }
        else {
            var candidateSelector = onTypeConflict != null
                ? onTypeConflictToCandidateSelector(onTypeConflict)
                : function (cands) { return cands[cands.length - 1]; };
            typeMap[typeName] = candidateSelector(typeCandidates[typeName]).type;
        }
    });
    return utils.rewireTypes(typeMap, directives);
}
function onTypeConflictToCandidateSelector(onTypeConflict) {
    return function (cands) {
        return cands.reduce(function (prev, next) {
            var type = onTypeConflict(prev.type, next.type, {
                left: {
                    subschema: prev.subschema,
                    transformedSubschema: prev.transformedSubschema,
                },
                right: {
                    subschema: prev.subschema,
                    transformedSubschema: prev.transformedSubschema,
                },
            });
            if (prev.type === type) {
                return prev;
            }
            else if (next.type === type) {
                return next;
            }
            return {
                schemaName: 'unknown',
                type: type,
            };
        });
    };
}

function createMergedTypeResolver(mergedTypeResolverOptions) {
    var fieldName = mergedTypeResolverOptions.fieldName, argsFromKeys = mergedTypeResolverOptions.argsFromKeys, valuesFromResults = mergedTypeResolverOptions.valuesFromResults, args = mergedTypeResolverOptions.args;
    if (argsFromKeys != null) {
        return function (originalResult, context, info, subschema, selectionSet, key) {
            var _a;
            return batchDelegate.batchDelegateToSchema({
                schema: subschema,
                operation: 'query',
                fieldName: fieldName,
                returnType: new graphql.GraphQLList(graphql.getNamedType((_a = info.schema.getType(originalResult.__typename)) !== null && _a !== void 0 ? _a : info.returnType)),
                key: key,
                argsFromKeys: argsFromKeys,
                valuesFromResults: valuesFromResults,
                selectionSet: selectionSet,
                context: context,
                info: info,
                skipTypeMerging: true,
            });
        };
    }
    if (args != null) {
        return function (originalResult, context, info, subschema, selectionSet) {
            var _a;
            return delegate.delegateToSchema({
                schema: subschema,
                operation: 'query',
                fieldName: fieldName,
                returnType: graphql.getNamedType((_a = info.schema.getType(originalResult.__typename)) !== null && _a !== void 0 ? _a : info.returnType),
                args: args(originalResult),
                selectionSet: selectionSet,
                context: context,
                info: info,
                skipTypeMerging: true,
            });
        };
    }
    return undefined;
}

function createStitchingInfo(subschemaMap, typeCandidates, mergeTypes) {
    var mergedTypes = createMergedTypes(typeCandidates, mergeTypes);
    var selectionSetsByField = Object.create(null);
    Object.entries(mergedTypes).forEach(function (_a) {
        var _b = tslib.__read(_a, 2), typeName = _b[0], mergedTypeInfo = _b[1];
        if (mergedTypeInfo.selectionSets == null && mergedTypeInfo.fieldSelectionSets == null) {
            return;
        }
        selectionSetsByField[typeName] = Object.create(null);
        mergedTypeInfo.selectionSets.forEach(function (selectionSet, subschemaConfig) {
            var schema = subschemaConfig.transformedSchema;
            var type = schema.getType(typeName);
            var fields = type.getFields();
            Object.keys(fields).forEach(function (fieldName) {
                var field = fields[fieldName];
                var fieldType = graphql.getNamedType(field.type);
                if (selectionSet && graphql.isLeafType(fieldType) && selectionSetContainsTopLevelField(selectionSet, fieldName)) {
                    return;
                }
                if (selectionSetsByField[typeName][fieldName] == null) {
                    selectionSetsByField[typeName][fieldName] = {
                        kind: graphql.Kind.SELECTION_SET,
                        selections: [utils.parseSelectionSet('{ __typename }', { noLocation: true }).selections[0]],
                    };
                }
                selectionSetsByField[typeName][fieldName].selections = selectionSetsByField[typeName][fieldName].selections.concat(selectionSet.selections);
            });
        });
        mergedTypeInfo.fieldSelectionSets.forEach(function (selectionSetFieldMap) {
            Object.keys(selectionSetFieldMap).forEach(function (fieldName) {
                if (selectionSetsByField[typeName][fieldName] == null) {
                    selectionSetsByField[typeName][fieldName] = {
                        kind: graphql.Kind.SELECTION_SET,
                        selections: [utils.parseSelectionSet('{ __typename }', { noLocation: true }).selections[0]],
                    };
                }
                selectionSetsByField[typeName][fieldName].selections = selectionSetsByField[typeName][fieldName].selections.concat(selectionSetFieldMap[fieldName].selections);
            });
        });
    });
    return {
        subschemaMap: subschemaMap,
        selectionSetsByType: undefined,
        selectionSetsByField: selectionSetsByField,
        dynamicSelectionSetsByField: undefined,
        mergedTypes: mergedTypes,
    };
}
function createMergedTypes(typeCandidates, mergeTypes) {
    var mergedTypes = Object.create(null);
    Object.keys(typeCandidates).forEach(function (typeName) {
        if (typeCandidates[typeName].length > 1 &&
            (graphql.isObjectType(typeCandidates[typeName][0].type) || graphql.isInterfaceType(typeCandidates[typeName][0].type))) {
            var typeCandidatesWithMergedTypeConfig = typeCandidates[typeName].filter(function (typeCandidate) {
                return typeCandidate.transformedSubschema != null &&
                    typeCandidate.transformedSubschema.merge != null &&
                    typeName in typeCandidate.transformedSubschema.merge;
            });
            if (mergeTypes === true ||
                (typeof mergeTypes === 'function' && mergeTypes(typeCandidates[typeName], typeName)) ||
                (Array.isArray(mergeTypes) && mergeTypes.includes(typeName)) ||
                typeCandidatesWithMergedTypeConfig.length) {
                var targetSubschemas_1 = [];
                var typeMaps_1 = new Map();
                var supportedBySubschemas_1 = Object.create({});
                var selectionSets_1 = new Map();
                var fieldSelectionSets_1 = new Map();
                var resolvers_1 = new Map();
                typeCandidates[typeName].forEach(function (typeCandidate) {
                    var _a, _b;
                    var subschema = typeCandidate.transformedSubschema;
                    if (subschema == null) {
                        return;
                    }
                    typeMaps_1.set(subschema, subschema.transformedSchema.getTypeMap());
                    var mergedTypeConfig = (_a = subschema === null || subschema === void 0 ? void 0 : subschema.merge) === null || _a === void 0 ? void 0 : _a[typeName];
                    if (mergedTypeConfig == null) {
                        return;
                    }
                    if (mergedTypeConfig.selectionSet) {
                        var selectionSet_1 = utils.parseSelectionSet(mergedTypeConfig.selectionSet, { noLocation: true });
                        selectionSets_1.set(subschema, selectionSet_1);
                    }
                    if (mergedTypeConfig.fields) {
                        var parsedFieldSelectionSets_1 = Object.create(null);
                        Object.keys(mergedTypeConfig.fields).forEach(function (fieldName) {
                            if (mergedTypeConfig.fields[fieldName].selectionSet) {
                                var rawFieldSelectionSet = mergedTypeConfig.fields[fieldName].selectionSet;
                                parsedFieldSelectionSets_1[fieldName] = utils.parseSelectionSet(rawFieldSelectionSet, { noLocation: true });
                            }
                        });
                        fieldSelectionSets_1.set(subschema, parsedFieldSelectionSets_1);
                    }
                    if (mergedTypeConfig.computedFields) {
                        var parsedFieldSelectionSets_2 = Object.create(null);
                        Object.keys(mergedTypeConfig.computedFields).forEach(function (fieldName) {
                            if (mergedTypeConfig.computedFields[fieldName].selectionSet) {
                                var rawFieldSelectionSet = mergedTypeConfig.computedFields[fieldName].selectionSet;
                                parsedFieldSelectionSets_2[fieldName] = utils.parseSelectionSet(rawFieldSelectionSet, { noLocation: true });
                            }
                        });
                        fieldSelectionSets_1.set(subschema, parsedFieldSelectionSets_2);
                    }
                    var resolver = (_b = mergedTypeConfig.resolve) !== null && _b !== void 0 ? _b : createMergedTypeResolver(mergedTypeConfig);
                    if (resolver == null) {
                        return;
                    }
                    var keyFn = mergedTypeConfig.key;
                    resolvers_1.set(subschema, keyFn
                        ? function (originalResult, context, info, subschema, selectionSet) {
                            var key = keyFn(originalResult);
                            return resolver(originalResult, context, info, subschema, selectionSet, key);
                        }
                        : resolver);
                    targetSubschemas_1.push(subschema);
                    var type = subschema.transformedSchema.getType(typeName);
                    var fieldMap = type.getFields();
                    var selectionSet = selectionSets_1.get(subschema);
                    Object.keys(fieldMap).forEach(function (fieldName) {
                        var field = fieldMap[fieldName];
                        var fieldType = graphql.getNamedType(field.type);
                        if (selectionSet && graphql.isLeafType(fieldType) && selectionSetContainsTopLevelField(selectionSet, fieldName)) {
                            return;
                        }
                        if (!(fieldName in supportedBySubschemas_1)) {
                            supportedBySubschemas_1[fieldName] = [];
                        }
                        supportedBySubschemas_1[fieldName].push(subschema);
                    });
                });
                var sourceSubschemas = typeCandidates[typeName]
                    .filter(function (typeCandidate) { return typeCandidate.transformedSubschema != null; })
                    .map(function (typeCandidate) { return typeCandidate.transformedSubschema; });
                var targetSubschemasBySubschema_1 = new Map();
                sourceSubschemas.forEach(function (subschema) {
                    var filteredSubschemas = targetSubschemas_1.filter(function (s) { return s !== subschema; });
                    if (filteredSubschemas.length) {
                        targetSubschemasBySubschema_1.set(subschema, filteredSubschemas);
                    }
                });
                mergedTypes[typeName] = {
                    typeName: typeName,
                    targetSubschemas: targetSubschemasBySubschema_1,
                    typeMaps: typeMaps_1,
                    selectionSets: selectionSets_1,
                    fieldSelectionSets: fieldSelectionSets_1,
                    uniqueFields: Object.create({}),
                    nonUniqueFields: Object.create({}),
                    resolvers: resolvers_1,
                };
                Object.keys(supportedBySubschemas_1).forEach(function (fieldName) {
                    if (supportedBySubschemas_1[fieldName].length === 1) {
                        mergedTypes[typeName].uniqueFields[fieldName] = supportedBySubschemas_1[fieldName][0];
                    }
                    else {
                        mergedTypes[typeName].nonUniqueFields[fieldName] = supportedBySubschemas_1[fieldName];
                    }
                });
            }
        }
    });
    return mergedTypes;
}
function completeStitchingInfo(stitchingInfo, resolvers, schema) {
    var selectionSetsByType = Object.create(null);
    [schema.getQueryType(), schema.getMutationType].forEach(function (rootType) {
        if (rootType) {
            selectionSetsByType[rootType.name] = utils.parseSelectionSet('{ __typename }', { noLocation: true });
        }
    });
    var selectionSetsByField = stitchingInfo.selectionSetsByField;
    var dynamicSelectionSetsByField = Object.create(null);
    Object.keys(resolvers).forEach(function (typeName) {
        var type = resolvers[typeName];
        if (graphql.isScalarType(type)) {
            return;
        }
        Object.keys(type).forEach(function (fieldName) {
            var field = type[fieldName];
            if (field.selectionSet) {
                if (typeof field.selectionSet === 'function') {
                    if (!(typeName in dynamicSelectionSetsByField)) {
                        dynamicSelectionSetsByField[typeName] = Object.create(null);
                    }
                    if (!(fieldName in dynamicSelectionSetsByField[typeName])) {
                        dynamicSelectionSetsByField[typeName][fieldName] = [];
                    }
                    dynamicSelectionSetsByField[typeName][fieldName].push(field.selectionSet);
                }
                else {
                    var selectionSet = utils.parseSelectionSet(field.selectionSet, { noLocation: true });
                    if (!(typeName in selectionSetsByField)) {
                        selectionSetsByField[typeName] = Object.create(null);
                    }
                    if (!(fieldName in selectionSetsByField[typeName])) {
                        selectionSetsByField[typeName][fieldName] = {
                            kind: graphql.Kind.SELECTION_SET,
                            selections: [],
                        };
                    }
                    selectionSetsByField[typeName][fieldName].selections = selectionSetsByField[typeName][fieldName].selections.concat(selectionSet.selections);
                }
            }
        });
    });
    Object.keys(selectionSetsByField).forEach(function (typeName) {
        var typeSelectionSets = selectionSetsByField[typeName];
        Object.keys(typeSelectionSets).forEach(function (fieldName) {
            var consolidatedSelections = new Map();
            var selectionSet = typeSelectionSets[fieldName];
            selectionSet.selections.forEach(function (selection) {
                consolidatedSelections.set(graphql.print(selection), selection);
            });
            selectionSet.selections = Array.from(consolidatedSelections.values());
        });
    });
    stitchingInfo.selectionSetsByType = selectionSetsByType;
    stitchingInfo.selectionSetsByField = selectionSetsByField;
    stitchingInfo.dynamicSelectionSetsByField = dynamicSelectionSetsByField;
    return stitchingInfo;
}
function addStitchingInfo(stitchedSchema, stitchingInfo) {
    return new graphql.GraphQLSchema(tslib.__assign(tslib.__assign({}, stitchedSchema.toConfig()), { extensions: tslib.__assign(tslib.__assign({}, stitchedSchema.extensions), { stitchingInfo: stitchingInfo }) }));
}
function selectionSetContainsTopLevelField(selectionSet, fieldName) {
    return selectionSet.selections.some(function (selection) { return selection.kind === graphql.Kind.FIELD && selection.name.value === fieldName; });
}

function isolateComputedFields(subschemaConfig) {
    var baseSchemaTypes = {};
    var isolatedSchemaTypes = {};
    if (subschemaConfig.merge == null) {
        return [subschemaConfig];
    }
    Object.keys(subschemaConfig.merge).forEach(function (typeName) {
        var mergedTypeConfig = subschemaConfig.merge[typeName];
        baseSchemaTypes[typeName] = mergedTypeConfig;
        if (mergedTypeConfig.computedFields) {
            var baseFields_1 = {};
            var isolatedFields_1 = {};
            Object.keys(mergedTypeConfig.computedFields).forEach(function (fieldName) {
                var mergedFieldConfig = mergedTypeConfig.computedFields[fieldName];
                if (mergedFieldConfig.selectionSet) {
                    isolatedFields_1[fieldName] = mergedFieldConfig;
                }
                else {
                    baseFields_1[fieldName] = mergedFieldConfig;
                }
            });
            var isolatedFieldCount = Object.keys(isolatedFields_1).length;
            var objectType = subschemaConfig.schema.getType(typeName);
            if (isolatedFieldCount && isolatedFieldCount !== Object.keys(objectType.getFields()).length) {
                baseSchemaTypes[typeName] = tslib.__assign(tslib.__assign({}, mergedTypeConfig), { fields: Object.keys(baseFields_1).length ? baseFields_1 : undefined });
                isolatedSchemaTypes[typeName] = tslib.__assign(tslib.__assign({}, mergedTypeConfig), { fields: isolatedFields_1 });
            }
        }
    });
    if (Object.keys(isolatedSchemaTypes).length) {
        return [
            filterBaseSubschema(tslib.__assign(tslib.__assign({}, subschemaConfig), { merge: baseSchemaTypes }), isolatedSchemaTypes),
            filterIsolatedSubschema(tslib.__assign(tslib.__assign({}, subschemaConfig), { merge: isolatedSchemaTypes })),
        ];
    }
    return [subschemaConfig];
}
function filterBaseSubschema(subschemaConfig, isolatedSchemaTypes) {
    var _a;
    var schema = subschemaConfig.schema;
    var typesForInterface = {};
    var filteredSchema = utils.pruneSchema(utils.filterSchema({
        schema: schema,
        objectFieldFilter: function (typeName, fieldName) { var _a; return !((_a = isolatedSchemaTypes[typeName]) === null || _a === void 0 ? void 0 : _a.fields[fieldName]); },
        interfaceFieldFilter: function (typeName, fieldName) {
            if (!typesForInterface[typeName]) {
                typesForInterface[typeName] = utils.getImplementingTypes(typeName, schema);
            }
            return !typesForInterface[typeName].some(function (implementingTypeName) { var _a; return (_a = isolatedSchemaTypes[implementingTypeName]) === null || _a === void 0 ? void 0 : _a.fields[fieldName]; });
        },
    }));
    var filteredFields = {};
    Object.keys(filteredSchema.getTypeMap()).forEach(function (typeName) {
        var type = filteredSchema.getType(typeName);
        if (graphql.isObjectType(type) || graphql.isInterfaceType(type)) {
            filteredFields[typeName] = { __typename: true };
            var fieldMap = type.getFields();
            Object.keys(fieldMap).forEach(function (fieldName) {
                filteredFields[typeName][fieldName] = true;
            });
        }
    });
    var filteredSubschema = tslib.__assign(tslib.__assign({}, subschemaConfig), { merge: subschemaConfig.merge
            ? tslib.__assign({}, subschemaConfig.merge) : undefined, transforms: ((_a = subschemaConfig.transforms) !== null && _a !== void 0 ? _a : []).concat([
            new wrap.TransformCompositeFields(function (typeName, fieldName) { var _a; return (((_a = filteredFields[typeName]) === null || _a === void 0 ? void 0 : _a[fieldName]) ? undefined : null); }, function (typeName, fieldName) { var _a; return (((_a = filteredFields[typeName]) === null || _a === void 0 ? void 0 : _a[fieldName]) ? undefined : null); }),
        ]) });
    var remainingTypes = filteredSchema.getTypeMap();
    Object.keys(filteredSubschema.merge).forEach(function (mergeType) {
        if (!remainingTypes[mergeType]) {
            delete filteredSubschema.merge[mergeType];
        }
    });
    if (!Object.keys(filteredSubschema.merge).length) {
        delete filteredSubschema.merge;
    }
    return filteredSubschema;
}
function filterIsolatedSubschema(subschemaConfig) {
    var _a;
    var rootFields = {};
    Object.keys(subschemaConfig.merge).forEach(function (typeName) {
        rootFields[subschemaConfig.merge[typeName].fieldName] = true;
    });
    var interfaceFields = {};
    Object.keys(subschemaConfig.merge).forEach(function (typeName) {
        subschemaConfig.schema.getType(typeName).getInterfaces().forEach(function (int) {
            Object.keys(subschemaConfig.schema.getType(int.name).getFields()).forEach(function (intFieldName) {
                if (subschemaConfig.merge[typeName].fields[intFieldName]) {
                    interfaceFields[int.name] = interfaceFields[int.name] || {};
                    interfaceFields[int.name][intFieldName] = true;
                }
            });
        });
    });
    var filteredSchema = utils.pruneSchema(utils.filterSchema({
        schema: subschemaConfig.schema,
        rootFieldFilter: function (operation, fieldName) { return operation === 'Query' && rootFields[fieldName] != null; },
        objectFieldFilter: function (typeName, fieldName) { var _a; return ((_a = subschemaConfig.merge[typeName]) === null || _a === void 0 ? void 0 : _a.fields[fieldName]) != null; },
        interfaceFieldFilter: function (typeName, fieldName) { var _a; return ((_a = interfaceFields[typeName]) === null || _a === void 0 ? void 0 : _a[fieldName]) != null; },
    }));
    var filteredFields = {};
    Object.keys(filteredSchema.getTypeMap()).forEach(function (typeName) {
        var type = filteredSchema.getType(typeName);
        if (graphql.isObjectType(type) || graphql.isInterfaceType(type)) {
            filteredFields[typeName] = { __typename: true };
            var fieldMap = type.getFields();
            Object.keys(fieldMap).forEach(function (fieldName) {
                filteredFields[typeName][fieldName] = true;
            });
        }
    });
    return tslib.__assign(tslib.__assign({}, subschemaConfig), { transforms: ((_a = subschemaConfig.transforms) !== null && _a !== void 0 ? _a : []).concat([
            new wrap.TransformCompositeFields(function (typeName, fieldName) { var _a; return (((_a = filteredFields[typeName]) === null || _a === void 0 ? void 0 : _a[fieldName]) ? undefined : null); }, function (typeName, fieldName) { var _a; return (((_a = filteredFields[typeName]) === null || _a === void 0 ? void 0 : _a[fieldName]) ? undefined : null); }),
        ]) });
}

function computedDirectiveTransformer(computedDirectiveName) {
    return function (subschemaConfig) {
        var _a;
        var newSubschemaConfig = delegate.cloneSubschemaConfig(subschemaConfig);
        utils.mapSchema(subschemaConfig.schema, (_a = {},
            _a[utils.MapperKind.OBJECT_FIELD] = function (fieldConfig, fieldName, typeName, schema) {
                var _a, _b, _c, _d;
                var mergeTypeConfig = (_a = newSubschemaConfig.merge) === null || _a === void 0 ? void 0 : _a[typeName];
                if (mergeTypeConfig == null) {
                    return undefined;
                }
                var computed = utils.getDirectives(schema, fieldConfig)[computedDirectiveName];
                if (computed == null) {
                    return undefined;
                }
                var selectionSet = computed.fields != null ? "{ " + computed.fields + " }" : computed.selectionSet;
                if (selectionSet == null) {
                    return undefined;
                }
                mergeTypeConfig.computedFields = (_b = mergeTypeConfig.computedFields) !== null && _b !== void 0 ? _b : {};
                mergeTypeConfig.computedFields[fieldName] = (_c = mergeTypeConfig.computedFields[fieldName]) !== null && _c !== void 0 ? _c : {};
                var mergeFieldConfig = mergeTypeConfig.computedFields[fieldName];
                mergeFieldConfig.selectionSet = (_d = mergeFieldConfig.selectionSet) !== null && _d !== void 0 ? _d : selectionSet;
                return undefined;
            },
            _a));
        return newSubschemaConfig;
    };
}

var defaultSubschemaConfigTransforms = [computedDirectiveTransformer('computed')];

function stitchSchemas(_a) {
    var _b = _a.subschemas, subschemas = _b === void 0 ? [] : _b, _c = _a.types, types = _c === void 0 ? [] : _c, typeDefs = _a.typeDefs, onTypeConflict = _a.onTypeConflict, mergeDirectives = _a.mergeDirectives, _d = _a.mergeTypes, mergeTypes = _d === void 0 ? true : _d, typeMergingOptions = _a.typeMergingOptions, _e = _a.subschemaConfigTransforms, subschemaConfigTransforms = _e === void 0 ? defaultSubschemaConfigTransforms : _e, _f = _a.resolvers, resolvers = _f === void 0 ? {} : _f, schemaDirectives = _a.schemaDirectives, _g = _a.inheritResolversFromInterfaces, inheritResolversFromInterfaces = _g === void 0 ? false : _g, logger = _a.logger, _h = _a.allowUndefinedInResolve, allowUndefinedInResolve = _h === void 0 ? true : _h, _j = _a.resolverValidationOptions, resolverValidationOptions = _j === void 0 ? {} : _j, directiveResolvers = _a.directiveResolvers, _k = _a.schemaTransforms, schemaTransforms = _k === void 0 ? [] : _k, _l = _a.parseOptions, parseOptions = _l === void 0 ? {} : _l, pruningOptions = _a.pruningOptions, updateResolversInPlace = _a.updateResolversInPlace;
    if (typeof resolverValidationOptions !== 'object') {
        throw new Error('Expected `resolverValidationOptions` to be an object');
    }
    var transformedSubschemas = [];
    var subschemaMap = new Map();
    var originalSubschemaMap = new Map();
    subschemas.forEach(function (subschemaOrSubschemaArray) {
        if (Array.isArray(subschemaOrSubschemaArray)) {
            subschemaOrSubschemaArray.forEach(function (s) {
                transformedSubschemas = transformedSubschemas.concat(applySubschemaConfigTransforms(subschemaConfigTransforms, s, subschemaMap, originalSubschemaMap));
            });
        }
        else {
            transformedSubschemas = transformedSubschemas.concat(applySubschemaConfigTransforms(subschemaConfigTransforms, subschemaOrSubschemaArray, subschemaMap, originalSubschemaMap));
        }
    });
    var extensions = [];
    var directives = [];
    var directiveMap = graphql.specifiedDirectives.reduce(function (acc, directive) {
        acc[directive.name] = directive;
        return acc;
    }, Object.create(null));
    var schemaDefs = Object.create(null);
    var operationTypeNames = {
        query: 'Query',
        mutation: 'Mutation',
        subscription: 'Subscription',
    };
    var typeCandidates = buildTypeCandidates({
        subschemas: transformedSubschemas,
        originalSubschemaMap: originalSubschemaMap,
        types: types,
        typeDefs: typeDefs,
        parseOptions: parseOptions,
        extensions: extensions,
        directiveMap: directiveMap,
        schemaDefs: schemaDefs,
        operationTypeNames: operationTypeNames,
        mergeDirectives: mergeDirectives,
    });
    Object.keys(directiveMap).forEach(function (directiveName) {
        directives.push(directiveMap[directiveName]);
    });
    var stitchingInfo = createStitchingInfo(subschemaMap, typeCandidates, mergeTypes);
    var _m = buildTypes({
        typeCandidates: typeCandidates,
        directives: directives,
        stitchingInfo: stitchingInfo,
        operationTypeNames: operationTypeNames,
        onTypeConflict: onTypeConflict,
        mergeTypes: mergeTypes,
        typeMergingOptions: typeMergingOptions,
    }), newTypeMap = _m.typeMap, newDirectives = _m.directives;
    var schema$1 = new graphql.GraphQLSchema({
        query: newTypeMap[operationTypeNames.query],
        mutation: newTypeMap[operationTypeNames.mutation],
        subscription: newTypeMap[operationTypeNames.subscription],
        types: Object.keys(newTypeMap).map(function (key) { return newTypeMap[key]; }),
        directives: newDirectives,
        astNode: schemaDefs.schemaDef,
        extensionASTNodes: schemaDefs.schemaExtensions,
        extensions: null,
    });
    extensions.forEach(function (extension) {
        schema$1 = graphql.extendSchema(schema$1, extension, {
            commentDescriptions: true,
        });
    });
    // We allow passing in an array of resolver maps, in which case we merge them
    var resolverMap = Array.isArray(resolvers) ? resolvers.reduce(utils.mergeDeep, {}) : resolvers;
    var finalResolvers = inheritResolversFromInterfaces
        ? schema.extendResolversFromInterfaces(schema$1, resolverMap)
        : resolverMap;
    stitchingInfo = completeStitchingInfo(stitchingInfo, finalResolvers, schema$1);
    schema$1 = schema.addResolversToSchema({
        schema: schema$1,
        defaultFieldResolver: delegate.defaultMergedResolver,
        resolvers: finalResolvers,
        resolverValidationOptions: resolverValidationOptions,
        inheritResolversFromInterfaces: false,
        updateResolversInPlace: updateResolversInPlace,
    });
    if (Object.keys(resolverValidationOptions).length > 0) {
        schema.assertResolversPresent(schema$1, resolverValidationOptions);
    }
    schema$1 = addStitchingInfo(schema$1, stitchingInfo);
    if (!allowUndefinedInResolve) {
        schema$1 = schema.addCatchUndefinedToSchema(schema$1);
    }
    if (logger != null) {
        schema$1 = schema.addErrorLoggingToSchema(schema$1, logger);
    }
    if (typeof finalResolvers['__schema'] === 'function') {
        // TODO a bit of a hack now, better rewrite generateSchema to attach it there.
        // not doing that now, because I'd have to rewrite a lot of tests.
        schema$1 = schema.addSchemaLevelResolver(schema$1, finalResolvers['__schema']);
    }
    schemaTransforms.forEach(function (schemaTransform) {
        schema$1 = schemaTransform(schema$1);
    });
    if (directiveResolvers != null) {
        schema$1 = schema.attachDirectiveResolvers(schema$1, directiveResolvers);
    }
    if (schemaDirectives != null) {
        utils.SchemaDirectiveVisitor.visitSchemaDirectives(schema$1, schemaDirectives);
    }
    if (pruningOptions) {
        schema$1 = utils.pruneSchema(schema$1, pruningOptions);
    }
    return schema$1;
}
function applySubschemaConfigTransforms(subschemaConfigTransforms, subschemaOrSubschemaConfig, subschemaMap, originalSubschemaMap) {
    var subschemaConfig = delegate.isSubschemaConfig(subschemaOrSubschemaConfig)
        ? subschemaOrSubschemaConfig
        : { schema: subschemaOrSubschemaConfig };
    var newSubschemaConfig = subschemaConfigTransforms.reduce(function (acc, subschemaConfigTransform) {
        return subschemaConfigTransform(acc);
    }, subschemaConfig);
    var transformedSubschemas = isolateComputedFields(newSubschemaConfig).map(function (subschemaConfig) { return new delegate.Subschema(subschemaConfig); });
    var baseSubschema = transformedSubschemas[0];
    subschemaMap.set(subschemaOrSubschemaConfig, baseSubschema);
    transformedSubschemas.forEach(function (subschema) { return originalSubschemaMap.set(subschema, subschemaOrSubschemaConfig); });
    return transformedSubschemas;
}

var forwardArgsToSelectionSet = function (selectionSet, mapping) {
    var selectionSetDef = utils.parseSelectionSet(selectionSet, { noLocation: true });
    return function (field) {
        var selections = selectionSetDef.selections.map(function (selectionNode) {
            if (selectionNode.kind === graphql.Kind.FIELD) {
                if (!mapping) {
                    return tslib.__assign(tslib.__assign({}, selectionNode), { arguments: field.arguments.slice() });
                }
                else if (selectionNode.name.value in mapping) {
                    var selectionArgs_1 = mapping[selectionNode.name.value];
                    return tslib.__assign(tslib.__assign({}, selectionNode), { arguments: field.arguments.filter(function (arg) { return selectionArgs_1.includes(arg.name.value); }) });
                }
            }
            return selectionNode;
        });
        return tslib.__assign(tslib.__assign({}, selectionSetDef), { selections: selections });
    };
};

exports.computedDirectiveTransformer = computedDirectiveTransformer;
exports.createMergedTypeResolver = createMergedTypeResolver;
exports.defaultSubschemaConfigTransforms = defaultSubschemaConfigTransforms;
exports.forwardArgsToSelectionSet = forwardArgsToSelectionSet;
exports.isolateComputedFields = isolateComputedFields;
exports.stitchSchemas = stitchSchemas;
//# sourceMappingURL=index.cjs.js.map
