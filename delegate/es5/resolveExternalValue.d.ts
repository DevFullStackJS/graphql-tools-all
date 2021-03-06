import { GraphQLResolveInfo, GraphQLError, GraphQLSchema } from 'graphql';
import { SubschemaConfig } from './types';
export declare function resolveExternalValue(result: any, unpathedErrors: Array<GraphQLError>, subschema: GraphQLSchema | SubschemaConfig, context: Record<string, any>, info: GraphQLResolveInfo, returnType?: import("graphql").GraphQLOutputType, skipTypeMerging?: boolean): any;
