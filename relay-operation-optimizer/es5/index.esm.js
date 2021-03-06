import { __assign, __spread } from 'tslib';
import { printSchemaWithDirectives } from '@graphql-tools/utils/es5';
import { concatAST, parse } from 'graphql';
import { transform as transform$2 } from 'relay-compiler/lib/transforms/SkipRedundantNodesTransform';
import { transform as transform$3 } from 'relay-compiler/lib/transforms/InlineFragmentsTransform';
import { transform as transform$1 } from 'relay-compiler/lib/transforms/ApplyFragmentArgumentTransform';
import { transformWithOptions } from 'relay-compiler/lib/transforms/FlattenTransform';
import CompilerContext from 'relay-compiler/lib/core/CompilerContext';
import { transform } from 'relay-compiler/lib/core/RelayParser';
import { print } from 'relay-compiler/lib/core/IRPrinter';
import { create } from 'relay-compiler/lib/core/Schema';

function optimizeDocuments(schema, documents, options) {
    if (options === void 0) { options = {}; }
    options = __assign({ noLocation: true }, options);
    // @TODO way for users to define directives they use, otherwise relay will throw an unknown directive error
    // Maybe we can scan the queries and add them dynamically without users having to do some extra stuff
    // transformASTSchema creates a new schema instance instead of mutating the old one
    var adjustedSchema = create(printSchemaWithDirectives(schema, options));
    var documentAsts = concatAST(documents);
    var relayDocuments = transform(adjustedSchema, documentAsts.definitions);
    var result = [];
    if (options.includeFragments) {
        var fragmentCompilerContext = new CompilerContext(adjustedSchema)
            .addAll(relayDocuments)
            .applyTransforms([
            transform$1,
            transformWithOptions({ flattenAbstractTypes: false }),
            transform$2,
        ]);
        result.push.apply(result, __spread(fragmentCompilerContext
            .documents()
            .filter(function (doc) { return doc.kind === 'Fragment'; })
            .map(function (doc) { return parse(print(adjustedSchema, doc), options); })));
    }
    var queryCompilerContext = new CompilerContext(adjustedSchema)
        .addAll(relayDocuments)
        .applyTransforms([
        transform$1,
        transform$3,
        transformWithOptions({ flattenAbstractTypes: false }),
        transform$2,
    ]);
    result.push.apply(result, __spread(queryCompilerContext.documents().map(function (doc) { return parse(print(adjustedSchema, doc), options); })));
    return result;
}

export { optimizeDocuments };
//# sourceMappingURL=index.esm.js.map
