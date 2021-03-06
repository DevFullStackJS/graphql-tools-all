import { parseGraphQLSDL, parseGraphQLJSON } from '@graphql-tools/utils';
import { fetch } from 'cross-fetch';
import { gqlPluckFromCodeString } from '@graphql-tools/graphql-tag-pluck';

// github:owner/name#ref:path/to/file
function extractData(pointer) {
    const [repo, file] = pointer.split('#');
    const [owner, name] = repo.split(':')[1].split('/');
    const [ref, path] = file.split(':');
    return {
        owner,
        name,
        ref,
        path,
    };
}
/**
 * This loader loads a file from GitHub.
 *
 * ```js
 * const typeDefs = await loadTypedefs('github:githubUser/githubRepo#branchName:path/to/file.ts', {
 *   loaders: [new GithubLoader()],
 *   token: YOUR_GITHUB_TOKEN,
 * })
 * ```
 */
class GithubLoader {
    loaderId() {
        return 'github-loader';
    }
    async canLoad(pointer) {
        return typeof pointer === 'string' && pointer.toLowerCase().startsWith('github:');
    }
    canLoadSync() {
        return false;
    }
    async load(pointer, options) {
        const { owner, name, ref, path } = extractData(pointer);
        const request = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `bearer ${options.token}`,
            },
            body: JSON.stringify({
                query: `
          query GetGraphQLSchemaForGraphQLtools($owner: String!, $name: String!, $expression: String!) {
            repository(owner: $owner, name: $name) {
              object(expression: $expression) {
                ... on Blob {
                  text
                }
              }
            }
          }
        `,
                variables: {
                    owner,
                    name,
                    expression: ref + ':' + path,
                },
                operationName: 'GetGraphQLSchemaForGraphQLtools',
            }),
        });
        const response = await request.json();
        let errorMessage = null;
        if (response.errors && response.errors.length > 0) {
            errorMessage = response.errors.map((item) => item.message).join(', ');
        }
        else if (!response.data) {
            errorMessage = response;
        }
        if (errorMessage) {
            throw new Error('Unable to download schema from github: ' + errorMessage);
        }
        const content = response.data.repository.object.text;
        if (/\.(gql|graphql)s?$/i.test(path)) {
            return parseGraphQLSDL(pointer, content, options);
        }
        if (/\.json$/i.test(path)) {
            return parseGraphQLJSON(pointer, content, options);
        }
        const rawSDL = await gqlPluckFromCodeString(pointer, content, options.pluckConfig);
        if (rawSDL) {
            return {
                location: pointer,
                rawSDL,
            };
        }
        throw new Error(`Invalid file extension: ${path}`);
    }
    loadSync() {
        throw new Error('Loader GitHub has no sync mode');
    }
}

export { GithubLoader };
//# sourceMappingURL=index.esm.js.map
