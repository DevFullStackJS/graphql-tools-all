import { GraphQLSchema, FieldNode, GraphQLResolveInfo } from 'graphql';
import { MergedTypeInfo, SubschemaConfig } from './types';
export declare const getFieldsNotInSubschema: (A1: GraphQLResolveInfo, A2: GraphQLSchema | SubschemaConfig<any, any, any>, A3: MergedTypeInfo) => FieldNode[];
