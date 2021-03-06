import { IDelegateToSchemaOptions, IDelegateRequestOptions } from './types';
export declare function delegateToSchema(options: IDelegateToSchemaOptions): any;
export declare function delegateRequest({ request, schema: subschemaOrSubschemaConfig, rootValue, info, operation, fieldName, args, returnType, onLocatedError, context, transforms, transformedSchema, skipValidation, skipTypeMerging, binding, }: IDelegateRequestOptions): any;
