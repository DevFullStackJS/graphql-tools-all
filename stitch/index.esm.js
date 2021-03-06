import { Kind, GraphQLDirective, valueFromASTUntyped, GraphQLInputObjectType, GraphQLScalarType, GraphQLUnionType, GraphQLEnumType, GraphQLInterfaceType, GraphQLObjectType, DirectiveLocation, TokenKind, getDirectiveValues, GraphQLDeprecatedDirective, isObjectType, isInputObjectType, isInterfaceType, isUnionType, isEnumType, isScalarType, isNamedType, getNamedType, isSpecifiedScalarType, GraphQLList, GraphQLSchema, isLeafType, print, specifiedDirectives, extendSchema } from 'graphql';
import { createStub, createNamedStub, fieldToFieldConfig, inputFieldToFieldConfig, rewireTypes, parseSelectionSet, pruneSchema, filterSchema, getImplementingTypes, mapSchema, MapperKind, getDirectives, mergeDeep, SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { buildDocumentFromTypeDefinitions, extendResolversFromInterfaces, addResolversToSchema, assertResolversPresent, addCatchUndefinedToSchema, addErrorLoggingToSchema, addSchemaLevelResolver, attachDirectiveResolvers } from '@graphql-tools/schema';
import { delegateToSchema, cloneSubschemaConfig, defaultMergedResolver, isSubschemaConfig, Subschema } from '@graphql-tools/delegate';
import { wrapSchema, TransformCompositeFields } from '@graphql-tools/wrap';
import { mergeType, mergeInputType, mergeInterface, mergeUnion, mergeEnum, mergeScalar } from '@graphql-tools/merge';
import { batchDelegateToSchema } from '@graphql-tools/batch-delegate';

const backcompatOptions = { commentDescriptions: true };
function typeFromAST(node) {
    switch (node.kind) {
        case Kind.OBJECT_TYPE_DEFINITION:
            return makeObjectType(node);
        case Kind.INTERFACE_TYPE_DEFINITION:
            return makeInterfaceType(node);
        case Kind.ENUM_TYPE_DEFINITION:
            return makeEnumType(node);
        case Kind.UNION_TYPE_DEFINITION:
            return makeUnionType(node);
        case Kind.SCALAR_TYPE_DEFINITION:
            return makeScalarType(node);
        case Kind.INPUT_OBJECT_TYPE_DEFINITION:
            return makeInputObjectType(node);
        case Kind.DIRECTIVE_DEFINITION:
            return makeDirective(node);
        default:
            return null;
    }
}
function makeObjectType(node) {
    const config = {
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        interfaces: () => node.interfaces.map(iface => createNamedStub(iface.name.value, 'interface')),
        fields: () => makeFields(node.fields),
        astNode: node,
    };
    return new GraphQLObjectType(config);
}
function makeInterfaceType(node) {
    var _a;
    const config = {
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        interfaces: (_a = node.interfaces) === null || _a === void 0 ? void 0 : _a.map(iface => createNamedStub(iface.name.value, 'interface')),
        fields: () => makeFields(node.fields),
        astNode: node,
    };
    return new GraphQLInterfaceType(config);
}
function makeEnumType(node) {
    const values = node.values.reduce((prev, value) => ({
        ...prev,
        [value.name.value]: {
            description: getDescription(value, backcompatOptions),
            deprecationReason: getDeprecationReason(value),
            astNode: value,
        },
    }), {});
    return new GraphQLEnumType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        values,
        astNode: node,
    });
}
function makeUnionType(node) {
    return new GraphQLUnionType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        types: () => node.types.map(type => createNamedStub(type.name.value, 'object')),
        astNode: node,
    });
}
function makeScalarType(node) {
    return new GraphQLScalarType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        astNode: node,
        // TODO: serialize default property setting can be dropped once
        // upstream graphql-js TypeScript typings are updated, likely in v16
        serialize: value => value,
    });
}
function makeInputObjectType(node) {
    return new GraphQLInputObjectType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        fields: () => makeValues(node.fields),
        astNode: node,
    });
}
function makeFields(nodes) {
    return nodes.reduce((prev, node) => ({
        ...prev,
        [node.name.value]: {
            type: createStub(node.type, 'output'),
            description: getDescription(node, backcompatOptions),
            args: makeValues(node.arguments),
            deprecationReason: getDeprecationReason(node),
            astNode: node,
        },
    }), {});
}
function makeValues(nodes) {
    return nodes.reduce((prev, node) => ({
        ...prev,
        [node.name.value]: {
            type: createStub(node.type, 'input'),
            defaultValue: node.defaultValue !== undefined ? valueFromASTUntyped(node.defaultValue) : undefined,
            description: getDescription(node, backcompatOptions),
            astNode: node,
        },
    }), {});
}
function makeDirective(node) {
    const locations = [];
    node.locations.forEach(location => {
        if (location.value in DirectiveLocation) {
            locations.push(location.value);
        }
    });
    return new GraphQLDirective({
        name: node.name.value,
        description: node.description != null ? node.description.value : null,
        locations,
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
        const rawValue = getLeadingCommentBlock(node);
        if (rawValue !== undefined) {
            return dedentBlockStringValue(`\n${rawValue}`);
        }
    }
}
function getLeadingCommentBlock(node) {
    const loc = node.loc;
    if (!loc) {
        return;
    }
    const comments = [];
    let token = loc.startToken.prev;
    while (token != null &&
        token.kind === TokenKind.COMMENT &&
        token.next != null &&
        token.prev != null &&
        token.line + 1 === token.next.line &&
        token.line !== token.prev.line) {
        const value = String(token.value);
        comments.push(value);
        token = token.prev;
    }
    return comments.length > 0 ? comments.reverse().join('\n') : undefined;
}
function dedentBlockStringValue(rawString) {
    // Expand a block string's raw value into independent lines.
    const lines = rawString.split(/\r\n|[\n\r]/g);
    // Remove common indentation from all lines but first.
    const commonIndent = getBlockStringIndentation(lines);
    if (commonIndent !== 0) {
        for (let i = 1; i < lines.length; i++) {
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
    let commonIndent = null;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const indent = leadingWhitespace(line);
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
    let i = 0;
    while (i < str.length && (str[i] === ' ' || str[i] === '\t')) {
        i++;
    }
    return i;
}
function isBlank(str) {
    return leadingWhitespace(str) === str.length;
}
function getDeprecationReason(node) {
    const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
    return deprecated === null || deprecated === void 0 ? void 0 : deprecated.reason;
}

function mergeCandidates(typeName, candidates, typeMergingOptions) {
    const initialCandidateType = candidates[0].type;
    if (candidates.some(candidate => candidate.type.constructor !== initialCandidateType.constructor)) {
        throw new Error(`Cannot merge different type categories into common type ${typeName}.`);
    }
    if (isObjectType(initialCandidateType)) {
        return mergeObjectTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else if (isInputObjectType(initialCandidateType)) {
        return mergeInputObjectTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else if (isInterfaceType(initialCandidateType)) {
        return mergeInterfaceTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else if (isUnionType(initialCandidateType)) {
        return mergeUnionTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else if (isEnumType(initialCandidateType)) {
        return mergeEnumTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else if (isScalarType(initialCandidateType)) {
        return mergeScalarTypeCandidates(typeName, candidates, typeMergingOptions);
    }
    else {
        // not reachable.
        throw new Error(`Type ${typeName} has unknown GraphQL type.`);
    }
}
function mergeObjectTypeCandidates(typeName, candidates, typeMergingOptions) {
    const description = mergeTypeDescriptions(candidates, typeMergingOptions);
    const fields = fieldConfigMapFromTypeCandidates(candidates, typeMergingOptions);
    const typeConfigs = candidates.map(candidate => candidate.type.toConfig());
    const interfaceMap = typeConfigs
        .map(typeConfig => typeConfig.interfaces)
        .reduce((acc, interfaces) => {
        if (interfaces != null) {
            interfaces.forEach(iface => {
                acc[iface.name] = iface;
            });
        }
        return acc;
    }, Object.create(null));
    const interfaces = Object.keys(interfaceMap).map(interfaceName => interfaceMap[interfaceName]);
    const astNodes = pluck('astNode', candidates);
    const astNode = astNodes
        .slice(1)
        .reduce((acc, astNode) => mergeType(astNode, acc), astNodes[0]);
    const extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    const extensions = Object.assign({}, ...pluck('extensions', candidates));
    const typeConfig = {
        name: typeName,
        description,
        fields,
        interfaces,
        astNode,
        extensionASTNodes,
        extensions,
    };
    return new GraphQLObjectType(typeConfig);
}
function mergeInputObjectTypeCandidates(typeName, candidates, typeMergingOptions) {
    const description = mergeTypeDescriptions(candidates, typeMergingOptions);
    const fields = inputFieldConfigMapFromTypeCandidates(candidates, typeMergingOptions);
    const astNodes = pluck('astNode', candidates);
    const astNode = astNodes
        .slice(1)
        .reduce((acc, astNode) => mergeInputType(astNode, acc), astNodes[0]);
    const extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    const extensions = Object.assign({}, ...pluck('extensions', candidates));
    const typeConfig = {
        name: typeName,
        description,
        fields,
        astNode,
        extensionASTNodes,
        extensions,
    };
    return new GraphQLInputObjectType(typeConfig);
}
function pluck(typeProperty, candidates) {
    return candidates.map(candidate => candidate.type[typeProperty]).filter(value => value != null);
}
function mergeInterfaceTypeCandidates(typeName, candidates, typeMergingOptions) {
    const description = mergeTypeDescriptions(candidates, typeMergingOptions);
    const fields = fieldConfigMapFromTypeCandidates(candidates, typeMergingOptions);
    const typeConfigs = candidates.map(candidate => candidate.type.toConfig());
    const interfaceMap = typeConfigs
        .map(typeConfig => typeConfig.interfaces)
        .reduce((acc, interfaces) => {
        if (interfaces != null) {
            interfaces.forEach(iface => {
                acc[iface.name] = iface;
            });
        }
        return acc;
    }, Object.create(null));
    const interfaces = Object.keys(interfaceMap).map(interfaceName => interfaceMap[interfaceName]);
    const astNodes = pluck('astNode', candidates);
    const astNode = astNodes
        .slice(1)
        .reduce((acc, astNode) => mergeInterface(astNode, acc, {}), astNodes[0]);
    const extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    const extensions = Object.assign({}, ...pluck('extensions', candidates));
    const typeConfig = {
        name: typeName,
        description,
        fields,
        interfaces,
        astNode,
        extensionASTNodes,
        extensions,
    };
    return new GraphQLInterfaceType(typeConfig);
}
function mergeUnionTypeCandidates(typeName, candidates, typeMergingOptions) {
    const description = mergeTypeDescriptions(candidates, typeMergingOptions);
    const typeConfigs = candidates.map(candidate => candidate.type.toConfig());
    const typeMap = typeConfigs.reduce((acc, typeConfig) => {
        typeConfig.types.forEach(type => {
            acc[type.name] = type;
        });
        return acc;
    }, Object.create(null));
    const types = Object.keys(typeMap).map(typeName => typeMap[typeName]);
    const astNodes = pluck('astNode', candidates);
    const astNode = astNodes
        .slice(1)
        .reduce((acc, astNode) => mergeUnion(astNode, acc), astNodes[0]);
    const extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    const extensions = Object.assign({}, ...pluck('extensions', candidates));
    const typeConfig = {
        name: typeName,
        description,
        types,
        astNode,
        extensionASTNodes,
        extensions,
    };
    return new GraphQLUnionType(typeConfig);
}
function mergeEnumTypeCandidates(typeName, candidates, typeMergingOptions) {
    const description = mergeTypeDescriptions(candidates, typeMergingOptions);
    const typeConfigs = candidates.map(candidate => candidate.type.toConfig());
    const values = typeConfigs.reduce((acc, typeConfig) => ({
        ...acc,
        ...typeConfig.values,
    }), {});
    const astNodes = pluck('astNode', candidates);
    const astNode = astNodes
        .slice(1)
        .reduce((acc, astNode) => mergeEnum(astNode, acc), astNodes[0]);
    const extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    const extensions = Object.assign({}, ...pluck('extensions', candidates));
    const typeConfig = {
        name: typeName,
        description,
        values,
        astNode,
        extensionASTNodes,
        extensions,
    };
    return new GraphQLEnumType(typeConfig);
}
function mergeScalarTypeCandidates(typeName, candidates, typeMergingOptions) {
    const description = mergeTypeDescriptions(candidates, typeMergingOptions);
    const serializeFns = pluck('serialize', candidates);
    const serialize = serializeFns[serializeFns.length - 1];
    const parseValueFns = pluck('parseValue', candidates);
    const parseValue = parseValueFns[parseValueFns.length - 1];
    const parseLiteralFns = pluck('parseLiteral', candidates);
    const parseLiteral = parseLiteralFns[parseLiteralFns.length - 1];
    const astNodes = pluck('astNode', candidates);
    const astNode = astNodes
        .slice(1)
        .reduce((acc, astNode) => mergeScalar(acc, astNode), astNodes[0]);
    const extensionASTNodes = [].concat(pluck('extensionASTNodes', candidates));
    const extensions = Object.assign({}, ...pluck('extensions', candidates));
    const typeConfig = {
        name: typeName,
        description,
        serialize,
        parseValue,
        parseLiteral,
        astNode,
        extensionASTNodes,
        extensions,
    };
    return new GraphQLScalarType(typeConfig);
}
function mergeTypeDescriptions(candidates, typeMergingOptions) {
    var _a;
    const typeDescriptionsMerger = (_a = typeMergingOptions === null || typeMergingOptions === void 0 ? void 0 : typeMergingOptions.typeDescriptionsMerger) !== null && _a !== void 0 ? _a : defaultTypeDescriptionMerger;
    return typeDescriptionsMerger(candidates);
}
function defaultTypeDescriptionMerger(candidates) {
    return candidates[candidates.length - 1].type.description;
}
function fieldConfigMapFromTypeCandidates(candidates, typeMergingOptions) {
    const fieldConfigCandidatesMap = Object.create(null);
    candidates.forEach(candidate => {
        const fieldMap = candidate.type.getFields();
        Object.keys(fieldMap).forEach(fieldName => {
            const fieldConfigCandidate = {
                fieldConfig: fieldToFieldConfig(fieldMap[fieldName]),
                fieldName,
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
    const fieldConfigMap = Object.create(null);
    Object.keys(fieldConfigCandidatesMap).forEach(fieldName => {
        fieldConfigMap[fieldName] = mergeFieldConfigs(fieldConfigCandidatesMap[fieldName], typeMergingOptions);
    });
    return fieldConfigMap;
}
function mergeFieldConfigs(candidates, typeMergingOptions) {
    var _a;
    const fieldConfigMerger = (_a = typeMergingOptions === null || typeMergingOptions === void 0 ? void 0 : typeMergingOptions.fieldConfigMerger) !== null && _a !== void 0 ? _a : defaultFieldConfigMerger;
    return fieldConfigMerger(candidates);
}
function defaultFieldConfigMerger(candidates) {
    return candidates[candidates.length - 1].fieldConfig;
}
function inputFieldConfigMapFromTypeCandidates(candidates, typeMergingOptions) {
    const inputFieldConfigCandidatesMap = Object.create(null);
    candidates.forEach(candidate => {
        const inputFieldMap = candidate.type.getFields();
        Object.keys(inputFieldMap).forEach(fieldName => {
            const inputFieldConfigCandidate = {
                inputFieldConfig: inputFieldToFieldConfig(inputFieldMap[fieldName]),
                fieldName,
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
    const inputFieldConfigMap = Object.create(null);
    Object.keys(inputFieldConfigCandidatesMap).forEach(fieldName => {
        inputFieldConfigMap[fieldName] = mergeInputFieldConfigs(inputFieldConfigCandidatesMap[fieldName], typeMergingOptions);
    });
    return inputFieldConfigMap;
}
function mergeInputFieldConfigs(candidates, typeMergingOptions) {
    var _a;
    const inputFieldConfigMerger = (_a = typeMergingOptions === null || typeMergingOptions === void 0 ? void 0 : typeMergingOptions.inputFieldConfigMerger) !== null && _a !== void 0 ? _a : defaultInputFieldConfigMerger;
    return inputFieldConfigMerger(candidates);
}
function defaultInputFieldConfigMerger(candidates) {
    return candidates[candidates.length - 1].inputFieldConfig;
}

function extractDefinitions(ast) {
    const typeDefinitions = [];
    const directiveDefs = [];
    const schemaDefs = [];
    const schemaExtensions = [];
    const extensionDefs = [];
    ast.definitions.forEach(def => {
        switch (def.kind) {
            case Kind.OBJECT_TYPE_DEFINITION:
            case Kind.INTERFACE_TYPE_DEFINITION:
            case Kind.INPUT_OBJECT_TYPE_DEFINITION:
            case Kind.UNION_TYPE_DEFINITION:
            case Kind.ENUM_TYPE_DEFINITION:
            case Kind.SCALAR_TYPE_DEFINITION:
                typeDefinitions.push(def);
                break;
            case Kind.DIRECTIVE_DEFINITION:
                directiveDefs.push(def);
                break;
            case Kind.SCHEMA_DEFINITION:
                schemaDefs.push(def);
                break;
            case Kind.SCHEMA_EXTENSION:
                schemaExtensions.push(def);
                break;
            case Kind.OBJECT_TYPE_EXTENSION:
            case Kind.INTERFACE_TYPE_EXTENSION:
            case Kind.INPUT_OBJECT_TYPE_EXTENSION:
            case Kind.UNION_TYPE_EXTENSION:
            case Kind.ENUM_TYPE_EXTENSION:
            case Kind.SCALAR_TYPE_EXTENSION:
                extensionDefs.push(def);
                break;
        }
    });
    return {
        typeDefinitions,
        directiveDefs,
        schemaDefs,
        schemaExtensions,
        extensionDefs,
    };
}

function buildTypeCandidates({ subschemas, originalSubschemaMap, types, typeDefs, parseOptions, extensions, directiveMap, schemaDefs, operationTypeNames, mergeDirectives, }) {
    const typeCandidates = Object.create(null);
    let schemaDef;
    let schemaExtensions = [];
    let document;
    let extraction;
    if ((typeDefs && !Array.isArray(typeDefs)) || (Array.isArray(typeDefs) && typeDefs.length)) {
        document = buildDocumentFromTypeDefinitions(typeDefs, parseOptions);
        extraction = extractDefinitions(document);
        schemaDef = extraction.schemaDefs[0];
        schemaExtensions = schemaExtensions.concat(extraction.schemaExtensions);
    }
    schemaDefs.schemaDef = schemaDef;
    schemaDefs.schemaExtensions = schemaExtensions;
    setOperationTypeNames(schemaDefs, operationTypeNames);
    subschemas.forEach(subschema => {
        const schema = wrapSchema(subschema);
        const operationTypes = {
            query: schema.getQueryType(),
            mutation: schema.getMutationType(),
            subscription: schema.getSubscriptionType(),
        };
        Object.keys(operationTypes).forEach(operationType => {
            if (operationTypes[operationType] != null) {
                addTypeCandidate(typeCandidates, operationTypeNames[operationType], {
                    type: operationTypes[operationType],
                    subschema: originalSubschemaMap.get(subschema),
                    transformedSubschema: subschema,
                });
            }
        });
        if (mergeDirectives) {
            schema.getDirectives().forEach(directive => {
                directiveMap[directive.name] = directive;
            });
        }
        const originalTypeMap = schema.getTypeMap();
        Object.keys(originalTypeMap).forEach(typeName => {
            const type = originalTypeMap[typeName];
            if (isNamedType(type) &&
                getNamedType(type).name.slice(0, 2) !== '__' &&
                type !== operationTypes.query &&
                type !== operationTypes.mutation &&
                type !== operationTypes.subscription) {
                addTypeCandidate(typeCandidates, type.name, {
                    type,
                    subschema: originalSubschemaMap.get(subschema),
                    transformedSubschema: subschema,
                });
            }
        });
    });
    if (document !== undefined) {
        extraction.typeDefinitions.forEach(def => {
            const type = typeFromAST(def);
            if (type != null) {
                addTypeCandidate(typeCandidates, type.name, { type });
            }
        });
        extraction.directiveDefs.forEach(def => {
            const directive = typeFromAST(def);
            directiveMap[directive.name] = directive;
        });
        if (extraction.extensionDefs.length > 0) {
            extensions.push({
                ...document,
                definitions: extraction.extensionDefs,
            });
        }
    }
    types.forEach(type => addTypeCandidate(typeCandidates, type.name, { type }));
    return typeCandidates;
}
function setOperationTypeNames({ schemaDef, schemaExtensions, }, operationTypeNames) {
    const allNodes = schemaExtensions.slice();
    if (schemaDef != null) {
        allNodes.unshift(schemaDef);
    }
    allNodes.forEach(node => {
        if (node.operationTypes != null) {
            node.operationTypes.forEach(operationType => {
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
function buildTypes({ typeCandidates, directives, stitchingInfo, operationTypeNames, onTypeConflict, mergeTypes, typeMergingOptions, }) {
    const typeMap = Object.create(null);
    Object.keys(typeCandidates).forEach(typeName => {
        if (typeName === operationTypeNames.query ||
            typeName === operationTypeNames.mutation ||
            typeName === operationTypeNames.subscription ||
            (mergeTypes === true && !typeCandidates[typeName].some(candidate => isSpecifiedScalarType(candidate.type))) ||
            (typeof mergeTypes === 'function' && mergeTypes(typeCandidates[typeName], typeName)) ||
            (Array.isArray(mergeTypes) && mergeTypes.includes(typeName)) ||
            (stitchingInfo != null && typeName in stitchingInfo.mergedTypes)) {
            typeMap[typeName] = mergeCandidates(typeName, typeCandidates[typeName], typeMergingOptions);
        }
        else {
            const candidateSelector = onTypeConflict != null
                ? onTypeConflictToCandidateSelector(onTypeConflict)
                : (cands) => cands[cands.length - 1];
            typeMap[typeName] = candidateSelector(typeCandidates[typeName]).type;
        }
    });
    return rewireTypes(typeMap, directives);
}
function onTypeConflictToCandidateSelector(onTypeConflict) {
    return cands => cands.reduce((prev, next) => {
        const type = onTypeConflict(prev.type, next.type, {
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
            type,
        };
    });
}

function createMergedTypeResolver(mergedTypeResolverOptions) {
    const { fieldName, argsFromKeys, valuesFromResults, args } = mergedTypeResolverOptions;
    if (argsFromKeys != null) {
        return (originalResult, context, info, subschema, selectionSet, key) => {
            var _a;
            return batchDelegateToSchema({
                schema: subschema,
                operation: 'query',
                fieldName,
                returnType: new GraphQLList(getNamedType((_a = info.schema.getType(originalResult.__typename)) !== null && _a !== void 0 ? _a : info.returnType)),
                key,
                argsFromKeys,
                valuesFromResults,
                selectionSet,
                context,
                info,
                skipTypeMerging: true,
            });
        };
    }
    if (args != null) {
        return (originalResult, context, info, subschema, selectionSet) => {
            var _a;
            return delegateToSchema({
                schema: subschema,
                operation: 'query',
                fieldName,
                returnType: getNamedType((_a = info.schema.getType(originalResult.__typename)) !== null && _a !== void 0 ? _a : info.returnType),
                args: args(originalResult),
                selectionSet,
                context,
                info,
                skipTypeMerging: true,
            });
        };
    }
    return undefined;
}

function createStitchingInfo(subschemaMap, typeCandidates, mergeTypes) {
    const mergedTypes = createMergedTypes(typeCandidates, mergeTypes);
    const selectionSetsByField = Object.create(null);
    Object.entries(mergedTypes).forEach(([typeName, mergedTypeInfo]) => {
        if (mergedTypeInfo.selectionSets == null && mergedTypeInfo.fieldSelectionSets == null) {
            return;
        }
        selectionSetsByField[typeName] = Object.create(null);
        mergedTypeInfo.selectionSets.forEach((selectionSet, subschemaConfig) => {
            const schema = subschemaConfig.transformedSchema;
            const type = schema.getType(typeName);
            const fields = type.getFields();
            Object.keys(fields).forEach(fieldName => {
                const field = fields[fieldName];
                const fieldType = getNamedType(field.type);
                if (selectionSet && isLeafType(fieldType) && selectionSetContainsTopLevelField(selectionSet, fieldName)) {
                    return;
                }
                if (selectionSetsByField[typeName][fieldName] == null) {
                    selectionSetsByField[typeName][fieldName] = {
                        kind: Kind.SELECTION_SET,
                        selections: [parseSelectionSet('{ __typename }', { noLocation: true }).selections[0]],
                    };
                }
                selectionSetsByField[typeName][fieldName].selections = selectionSetsByField[typeName][fieldName].selections.concat(selectionSet.selections);
            });
        });
        mergedTypeInfo.fieldSelectionSets.forEach(selectionSetFieldMap => {
            Object.keys(selectionSetFieldMap).forEach(fieldName => {
                if (selectionSetsByField[typeName][fieldName] == null) {
                    selectionSetsByField[typeName][fieldName] = {
                        kind: Kind.SELECTION_SET,
                        selections: [parseSelectionSet('{ __typename }', { noLocation: true }).selections[0]],
                    };
                }
                selectionSetsByField[typeName][fieldName].selections = selectionSetsByField[typeName][fieldName].selections.concat(selectionSetFieldMap[fieldName].selections);
            });
        });
    });
    return {
        subschemaMap,
        selectionSetsByType: undefined,
        selectionSetsByField,
        dynamicSelectionSetsByField: undefined,
        mergedTypes,
    };
}
function createMergedTypes(typeCandidates, mergeTypes) {
    const mergedTypes = Object.create(null);
    Object.keys(typeCandidates).forEach(typeName => {
        if (typeCandidates[typeName].length > 1 &&
            (isObjectType(typeCandidates[typeName][0].type) || isInterfaceType(typeCandidates[typeName][0].type))) {
            const typeCandidatesWithMergedTypeConfig = typeCandidates[typeName].filter(typeCandidate => typeCandidate.transformedSubschema != null &&
                typeCandidate.transformedSubschema.merge != null &&
                typeName in typeCandidate.transformedSubschema.merge);
            if (mergeTypes === true ||
                (typeof mergeTypes === 'function' && mergeTypes(typeCandidates[typeName], typeName)) ||
                (Array.isArray(mergeTypes) && mergeTypes.includes(typeName)) ||
                typeCandidatesWithMergedTypeConfig.length) {
                const targetSubschemas = [];
                const typeMaps = new Map();
                const supportedBySubschemas = Object.create({});
                const selectionSets = new Map();
                const fieldSelectionSets = new Map();
                const resolvers = new Map();
                typeCandidates[typeName].forEach(typeCandidate => {
                    var _a, _b;
                    const subschema = typeCandidate.transformedSubschema;
                    if (subschema == null) {
                        return;
                    }
                    typeMaps.set(subschema, subschema.transformedSchema.getTypeMap());
                    const mergedTypeConfig = (_a = subschema === null || subschema === void 0 ? void 0 : subschema.merge) === null || _a === void 0 ? void 0 : _a[typeName];
                    if (mergedTypeConfig == null) {
                        return;
                    }
                    if (mergedTypeConfig.selectionSet) {
                        const selectionSet = parseSelectionSet(mergedTypeConfig.selectionSet, { noLocation: true });
                        selectionSets.set(subschema, selectionSet);
                    }
                    if (mergedTypeConfig.fields) {
                        const parsedFieldSelectionSets = Object.create(null);
                        Object.keys(mergedTypeConfig.fields).forEach(fieldName => {
                            if (mergedTypeConfig.fields[fieldName].selectionSet) {
                                const rawFieldSelectionSet = mergedTypeConfig.fields[fieldName].selectionSet;
                                parsedFieldSelectionSets[fieldName] = parseSelectionSet(rawFieldSelectionSet, { noLocation: true });
                            }
                        });
                        fieldSelectionSets.set(subschema, parsedFieldSelectionSets);
                    }
                    if (mergedTypeConfig.computedFields) {
                        const parsedFieldSelectionSets = Object.create(null);
                        Object.keys(mergedTypeConfig.computedFields).forEach(fieldName => {
                            if (mergedTypeConfig.computedFields[fieldName].selectionSet) {
                                const rawFieldSelectionSet = mergedTypeConfig.computedFields[fieldName].selectionSet;
                                parsedFieldSelectionSets[fieldName] = parseSelectionSet(rawFieldSelectionSet, { noLocation: true });
                            }
                        });
                        fieldSelectionSets.set(subschema, parsedFieldSelectionSets);
                    }
                    const resolver = (_b = mergedTypeConfig.resolve) !== null && _b !== void 0 ? _b : createMergedTypeResolver(mergedTypeConfig);
                    if (resolver == null) {
                        return;
                    }
                    const keyFn = mergedTypeConfig.key;
                    resolvers.set(subschema, keyFn
                        ? (originalResult, context, info, subschema, selectionSet) => {
                            const key = keyFn(originalResult);
                            return resolver(originalResult, context, info, subschema, selectionSet, key);
                        }
                        : resolver);
                    targetSubschemas.push(subschema);
                    const type = subschema.transformedSchema.getType(typeName);
                    const fieldMap = type.getFields();
                    const selectionSet = selectionSets.get(subschema);
                    Object.keys(fieldMap).forEach(fieldName => {
                        const field = fieldMap[fieldName];
                        const fieldType = getNamedType(field.type);
                        if (selectionSet && isLeafType(fieldType) && selectionSetContainsTopLevelField(selectionSet, fieldName)) {
                            return;
                        }
                        if (!(fieldName in supportedBySubschemas)) {
                            supportedBySubschemas[fieldName] = [];
                        }
                        supportedBySubschemas[fieldName].push(subschema);
                    });
                });
                const sourceSubschemas = typeCandidates[typeName]
                    .filter(typeCandidate => typeCandidate.transformedSubschema != null)
                    .map(typeCandidate => typeCandidate.transformedSubschema);
                const targetSubschemasBySubschema = new Map();
                sourceSubschemas.forEach(subschema => {
                    const filteredSubschemas = targetSubschemas.filter(s => s !== subschema);
                    if (filteredSubschemas.length) {
                        targetSubschemasBySubschema.set(subschema, filteredSubschemas);
                    }
                });
                mergedTypes[typeName] = {
                    typeName,
                    targetSubschemas: targetSubschemasBySubschema,
                    typeMaps,
                    selectionSets,
                    fieldSelectionSets,
                    uniqueFields: Object.create({}),
                    nonUniqueFields: Object.create({}),
                    resolvers,
                };
                Object.keys(supportedBySubschemas).forEach(fieldName => {
                    if (supportedBySubschemas[fieldName].length === 1) {
                        mergedTypes[typeName].uniqueFields[fieldName] = supportedBySubschemas[fieldName][0];
                    }
                    else {
                        mergedTypes[typeName].nonUniqueFields[fieldName] = supportedBySubschemas[fieldName];
                    }
                });
            }
        }
    });
    return mergedTypes;
}
function completeStitchingInfo(stitchingInfo, resolvers, schema) {
    const selectionSetsByType = Object.create(null);
    [schema.getQueryType(), schema.getMutationType].forEach(rootType => {
        if (rootType) {
            selectionSetsByType[rootType.name] = parseSelectionSet('{ __typename }', { noLocation: true });
        }
    });
    const selectionSetsByField = stitchingInfo.selectionSetsByField;
    const dynamicSelectionSetsByField = Object.create(null);
    Object.keys(resolvers).forEach(typeName => {
        const type = resolvers[typeName];
        if (isScalarType(type)) {
            return;
        }
        Object.keys(type).forEach(fieldName => {
            const field = type[fieldName];
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
                    const selectionSet = parseSelectionSet(field.selectionSet, { noLocation: true });
                    if (!(typeName in selectionSetsByField)) {
                        selectionSetsByField[typeName] = Object.create(null);
                    }
                    if (!(fieldName in selectionSetsByField[typeName])) {
                        selectionSetsByField[typeName][fieldName] = {
                            kind: Kind.SELECTION_SET,
                            selections: [],
                        };
                    }
                    selectionSetsByField[typeName][fieldName].selections = selectionSetsByField[typeName][fieldName].selections.concat(selectionSet.selections);
                }
            }
        });
    });
    Object.keys(selectionSetsByField).forEach(typeName => {
        const typeSelectionSets = selectionSetsByField[typeName];
        Object.keys(typeSelectionSets).forEach(fieldName => {
            const consolidatedSelections = new Map();
            const selectionSet = typeSelectionSets[fieldName];
            selectionSet.selections.forEach(selection => {
                consolidatedSelections.set(print(selection), selection);
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
    return new GraphQLSchema({
        ...stitchedSchema.toConfig(),
        extensions: {
            ...stitchedSchema.extensions,
            stitchingInfo,
        },
    });
}
function selectionSetContainsTopLevelField(selectionSet, fieldName) {
    return selectionSet.selections.some(selection => selection.kind === Kind.FIELD && selection.name.value === fieldName);
}

function isolateComputedFields(subschemaConfig) {
    const baseSchemaTypes = {};
    const isolatedSchemaTypes = {};
    if (subschemaConfig.merge == null) {
        return [subschemaConfig];
    }
    Object.keys(subschemaConfig.merge).forEach((typeName) => {
        const mergedTypeConfig = subschemaConfig.merge[typeName];
        baseSchemaTypes[typeName] = mergedTypeConfig;
        if (mergedTypeConfig.computedFields) {
            const baseFields = {};
            const isolatedFields = {};
            Object.keys(mergedTypeConfig.computedFields).forEach((fieldName) => {
                const mergedFieldConfig = mergedTypeConfig.computedFields[fieldName];
                if (mergedFieldConfig.selectionSet) {
                    isolatedFields[fieldName] = mergedFieldConfig;
                }
                else {
                    baseFields[fieldName] = mergedFieldConfig;
                }
            });
            const isolatedFieldCount = Object.keys(isolatedFields).length;
            const objectType = subschemaConfig.schema.getType(typeName);
            if (isolatedFieldCount && isolatedFieldCount !== Object.keys(objectType.getFields()).length) {
                baseSchemaTypes[typeName] = {
                    ...mergedTypeConfig,
                    fields: Object.keys(baseFields).length ? baseFields : undefined,
                };
                isolatedSchemaTypes[typeName] = { ...mergedTypeConfig, fields: isolatedFields };
            }
        }
    });
    if (Object.keys(isolatedSchemaTypes).length) {
        return [
            filterBaseSubschema({ ...subschemaConfig, merge: baseSchemaTypes }, isolatedSchemaTypes),
            filterIsolatedSubschema({ ...subschemaConfig, merge: isolatedSchemaTypes }),
        ];
    }
    return [subschemaConfig];
}
function filterBaseSubschema(subschemaConfig, isolatedSchemaTypes) {
    var _a;
    const schema = subschemaConfig.schema;
    const typesForInterface = {};
    const filteredSchema = pruneSchema(filterSchema({
        schema,
        objectFieldFilter: (typeName, fieldName) => { var _a; return !((_a = isolatedSchemaTypes[typeName]) === null || _a === void 0 ? void 0 : _a.fields[fieldName]); },
        interfaceFieldFilter: (typeName, fieldName) => {
            if (!typesForInterface[typeName]) {
                typesForInterface[typeName] = getImplementingTypes(typeName, schema);
            }
            return !typesForInterface[typeName].some(implementingTypeName => { var _a; return (_a = isolatedSchemaTypes[implementingTypeName]) === null || _a === void 0 ? void 0 : _a.fields[fieldName]; });
        },
    }));
    const filteredFields = {};
    Object.keys(filteredSchema.getTypeMap()).forEach(typeName => {
        const type = filteredSchema.getType(typeName);
        if (isObjectType(type) || isInterfaceType(type)) {
            filteredFields[typeName] = { __typename: true };
            const fieldMap = type.getFields();
            Object.keys(fieldMap).forEach(fieldName => {
                filteredFields[typeName][fieldName] = true;
            });
        }
    });
    const filteredSubschema = {
        ...subschemaConfig,
        merge: subschemaConfig.merge
            ? {
                ...subschemaConfig.merge,
            }
            : undefined,
        transforms: ((_a = subschemaConfig.transforms) !== null && _a !== void 0 ? _a : []).concat([
            new TransformCompositeFields((typeName, fieldName) => { var _a; return (((_a = filteredFields[typeName]) === null || _a === void 0 ? void 0 : _a[fieldName]) ? undefined : null); }, (typeName, fieldName) => { var _a; return (((_a = filteredFields[typeName]) === null || _a === void 0 ? void 0 : _a[fieldName]) ? undefined : null); }),
        ]),
    };
    const remainingTypes = filteredSchema.getTypeMap();
    Object.keys(filteredSubschema.merge).forEach(mergeType => {
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
    const rootFields = {};
    Object.keys(subschemaConfig.merge).forEach(typeName => {
        rootFields[subschemaConfig.merge[typeName].fieldName] = true;
    });
    const interfaceFields = {};
    Object.keys(subschemaConfig.merge).forEach(typeName => {
        subschemaConfig.schema.getType(typeName).getInterfaces().forEach(int => {
            Object.keys(subschemaConfig.schema.getType(int.name).getFields()).forEach(intFieldName => {
                if (subschemaConfig.merge[typeName].fields[intFieldName]) {
                    interfaceFields[int.name] = interfaceFields[int.name] || {};
                    interfaceFields[int.name][intFieldName] = true;
                }
            });
        });
    });
    const filteredSchema = pruneSchema(filterSchema({
        schema: subschemaConfig.schema,
        rootFieldFilter: (operation, fieldName) => operation === 'Query' && rootFields[fieldName] != null,
        objectFieldFilter: (typeName, fieldName) => { var _a; return ((_a = subschemaConfig.merge[typeName]) === null || _a === void 0 ? void 0 : _a.fields[fieldName]) != null; },
        interfaceFieldFilter: (typeName, fieldName) => { var _a; return ((_a = interfaceFields[typeName]) === null || _a === void 0 ? void 0 : _a[fieldName]) != null; },
    }));
    const filteredFields = {};
    Object.keys(filteredSchema.getTypeMap()).forEach(typeName => {
        const type = filteredSchema.getType(typeName);
        if (isObjectType(type) || isInterfaceType(type)) {
            filteredFields[typeName] = { __typename: true };
            const fieldMap = type.getFields();
            Object.keys(fieldMap).forEach(fieldName => {
                filteredFields[typeName][fieldName] = true;
            });
        }
    });
    return {
        ...subschemaConfig,
        transforms: ((_a = subschemaConfig.transforms) !== null && _a !== void 0 ? _a : []).concat([
            new TransformCompositeFields((typeName, fieldName) => { var _a; return (((_a = filteredFields[typeName]) === null || _a === void 0 ? void 0 : _a[fieldName]) ? undefined : null); }, (typeName, fieldName) => { var _a; return (((_a = filteredFields[typeName]) === null || _a === void 0 ? void 0 : _a[fieldName]) ? undefined : null); }),
        ]),
    };
}

function computedDirectiveTransformer(computedDirectiveName) {
    return (subschemaConfig) => {
        const newSubschemaConfig = cloneSubschemaConfig(subschemaConfig);
        mapSchema(subschemaConfig.schema, {
            [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName, schema) => {
                var _a, _b, _c, _d;
                const mergeTypeConfig = (_a = newSubschemaConfig.merge) === null || _a === void 0 ? void 0 : _a[typeName];
                if (mergeTypeConfig == null) {
                    return undefined;
                }
                const computed = getDirectives(schema, fieldConfig)[computedDirectiveName];
                if (computed == null) {
                    return undefined;
                }
                const selectionSet = computed.fields != null ? `{ ${computed.fields} }` : computed.selectionSet;
                if (selectionSet == null) {
                    return undefined;
                }
                mergeTypeConfig.computedFields = (_b = mergeTypeConfig.computedFields) !== null && _b !== void 0 ? _b : {};
                mergeTypeConfig.computedFields[fieldName] = (_c = mergeTypeConfig.computedFields[fieldName]) !== null && _c !== void 0 ? _c : {};
                const mergeFieldConfig = mergeTypeConfig.computedFields[fieldName];
                mergeFieldConfig.selectionSet = (_d = mergeFieldConfig.selectionSet) !== null && _d !== void 0 ? _d : selectionSet;
                return undefined;
            },
        });
        return newSubschemaConfig;
    };
}

const defaultSubschemaConfigTransforms = [computedDirectiveTransformer('computed')];

function stitchSchemas({ subschemas = [], types = [], typeDefs, onTypeConflict, mergeDirectives, mergeTypes = true, typeMergingOptions, subschemaConfigTransforms = defaultSubschemaConfigTransforms, resolvers = {}, schemaDirectives, inheritResolversFromInterfaces = false, logger, allowUndefinedInResolve = true, resolverValidationOptions = {}, directiveResolvers, schemaTransforms = [], parseOptions = {}, pruningOptions, updateResolversInPlace, }) {
    if (typeof resolverValidationOptions !== 'object') {
        throw new Error('Expected `resolverValidationOptions` to be an object');
    }
    let transformedSubschemas = [];
    const subschemaMap = new Map();
    const originalSubschemaMap = new Map();
    subschemas.forEach(subschemaOrSubschemaArray => {
        if (Array.isArray(subschemaOrSubschemaArray)) {
            subschemaOrSubschemaArray.forEach(s => {
                transformedSubschemas = transformedSubschemas.concat(applySubschemaConfigTransforms(subschemaConfigTransforms, s, subschemaMap, originalSubschemaMap));
            });
        }
        else {
            transformedSubschemas = transformedSubschemas.concat(applySubschemaConfigTransforms(subschemaConfigTransforms, subschemaOrSubschemaArray, subschemaMap, originalSubschemaMap));
        }
    });
    const extensions = [];
    const directives = [];
    const directiveMap = specifiedDirectives.reduce((acc, directive) => {
        acc[directive.name] = directive;
        return acc;
    }, Object.create(null));
    const schemaDefs = Object.create(null);
    const operationTypeNames = {
        query: 'Query',
        mutation: 'Mutation',
        subscription: 'Subscription',
    };
    const typeCandidates = buildTypeCandidates({
        subschemas: transformedSubschemas,
        originalSubschemaMap,
        types,
        typeDefs,
        parseOptions,
        extensions,
        directiveMap,
        schemaDefs,
        operationTypeNames,
        mergeDirectives,
    });
    Object.keys(directiveMap).forEach(directiveName => {
        directives.push(directiveMap[directiveName]);
    });
    let stitchingInfo = createStitchingInfo(subschemaMap, typeCandidates, mergeTypes);
    const { typeMap: newTypeMap, directives: newDirectives } = buildTypes({
        typeCandidates,
        directives,
        stitchingInfo,
        operationTypeNames,
        onTypeConflict,
        mergeTypes,
        typeMergingOptions,
    });
    let schema = new GraphQLSchema({
        query: newTypeMap[operationTypeNames.query],
        mutation: newTypeMap[operationTypeNames.mutation],
        subscription: newTypeMap[operationTypeNames.subscription],
        types: Object.keys(newTypeMap).map(key => newTypeMap[key]),
        directives: newDirectives,
        astNode: schemaDefs.schemaDef,
        extensionASTNodes: schemaDefs.schemaExtensions,
        extensions: null,
    });
    extensions.forEach(extension => {
        schema = extendSchema(schema, extension, {
            commentDescriptions: true,
        });
    });
    // We allow passing in an array of resolver maps, in which case we merge them
    const resolverMap = Array.isArray(resolvers) ? resolvers.reduce(mergeDeep, {}) : resolvers;
    const finalResolvers = inheritResolversFromInterfaces
        ? extendResolversFromInterfaces(schema, resolverMap)
        : resolverMap;
    stitchingInfo = completeStitchingInfo(stitchingInfo, finalResolvers, schema);
    schema = addResolversToSchema({
        schema,
        defaultFieldResolver: defaultMergedResolver,
        resolvers: finalResolvers,
        resolverValidationOptions,
        inheritResolversFromInterfaces: false,
        updateResolversInPlace,
    });
    if (Object.keys(resolverValidationOptions).length > 0) {
        assertResolversPresent(schema, resolverValidationOptions);
    }
    schema = addStitchingInfo(schema, stitchingInfo);
    if (!allowUndefinedInResolve) {
        schema = addCatchUndefinedToSchema(schema);
    }
    if (logger != null) {
        schema = addErrorLoggingToSchema(schema, logger);
    }
    if (typeof finalResolvers['__schema'] === 'function') {
        // TODO a bit of a hack now, better rewrite generateSchema to attach it there.
        // not doing that now, because I'd have to rewrite a lot of tests.
        schema = addSchemaLevelResolver(schema, finalResolvers['__schema']);
    }
    schemaTransforms.forEach(schemaTransform => {
        schema = schemaTransform(schema);
    });
    if (directiveResolvers != null) {
        schema = attachDirectiveResolvers(schema, directiveResolvers);
    }
    if (schemaDirectives != null) {
        SchemaDirectiveVisitor.visitSchemaDirectives(schema, schemaDirectives);
    }
    if (pruningOptions) {
        schema = pruneSchema(schema, pruningOptions);
    }
    return schema;
}
function applySubschemaConfigTransforms(subschemaConfigTransforms, subschemaOrSubschemaConfig, subschemaMap, originalSubschemaMap) {
    const subschemaConfig = isSubschemaConfig(subschemaOrSubschemaConfig)
        ? subschemaOrSubschemaConfig
        : { schema: subschemaOrSubschemaConfig };
    const newSubschemaConfig = subschemaConfigTransforms.reduce((acc, subschemaConfigTransform) => {
        return subschemaConfigTransform(acc);
    }, subschemaConfig);
    const transformedSubschemas = isolateComputedFields(newSubschemaConfig).map(subschemaConfig => new Subschema(subschemaConfig));
    const baseSubschema = transformedSubschemas[0];
    subschemaMap.set(subschemaOrSubschemaConfig, baseSubschema);
    transformedSubschemas.forEach(subschema => originalSubschemaMap.set(subschema, subschemaOrSubschemaConfig));
    return transformedSubschemas;
}

const forwardArgsToSelectionSet = (selectionSet, mapping) => {
    const selectionSetDef = parseSelectionSet(selectionSet, { noLocation: true });
    return (field) => {
        const selections = selectionSetDef.selections.map((selectionNode) => {
            if (selectionNode.kind === Kind.FIELD) {
                if (!mapping) {
                    return { ...selectionNode, arguments: field.arguments.slice() };
                }
                else if (selectionNode.name.value in mapping) {
                    const selectionArgs = mapping[selectionNode.name.value];
                    return {
                        ...selectionNode,
                        arguments: field.arguments.filter((arg) => selectionArgs.includes(arg.name.value)),
                    };
                }
            }
            return selectionNode;
        });
        return { ...selectionSetDef, selections };
    };
};

export { computedDirectiveTransformer, createMergedTypeResolver, defaultSubschemaConfigTransforms, forwardArgsToSelectionSet, isolateComputedFields, stitchSchemas };
//# sourceMappingURL=index.esm.js.map
