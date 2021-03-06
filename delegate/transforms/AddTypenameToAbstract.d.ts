import { Request } from '@graphql-tools/utils';
import { Transform, DelegationContext } from '../types';
export default class AddTypenameToAbstract implements Transform {
    transformRequest(originalRequest: Request, delegationContext: DelegationContext, _transformationContext: Record<string, any>): Request;
}
