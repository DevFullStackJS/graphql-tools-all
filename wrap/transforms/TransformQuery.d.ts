import { SelectionSetNode, FragmentDefinitionNode } from 'graphql';
import { Request, ExecutionResult } from '@graphql-tools/utils';
import { Transform, DelegationContext } from '@graphql-tools/delegate';
export declare type QueryTransformer = (selectionSet: SelectionSetNode, fragments: Record<string, FragmentDefinitionNode>) => SelectionSetNode;
export declare type ResultTransformer = (result: any) => any;
export declare type ErrorPathTransformer = (path: ReadonlyArray<string | number>) => Array<string | number>;
export default class TransformQuery implements Transform {
    private readonly path;
    private readonly queryTransformer;
    private readonly resultTransformer;
    private readonly errorPathTransformer;
    private readonly fragments;
    constructor({ path, queryTransformer, resultTransformer, errorPathTransformer, fragments, }: {
        path: Array<string>;
        queryTransformer: QueryTransformer;
        resultTransformer?: ResultTransformer;
        errorPathTransformer?: ErrorPathTransformer;
        fragments?: Record<string, FragmentDefinitionNode>;
    });
    transformRequest(originalRequest: Request, _delegationContext: DelegationContext, _transformationContext: Record<string, any>): Request;
    transformResult(originalResult: ExecutionResult, _delegationContext: DelegationContext, _transformationContext: Record<string, any>): ExecutionResult;
    private transformData;
    private transformErrors;
}
