'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const graphqlTagPluck = require('@graphql-tools/graphql-tag-pluck');
const child_process = require('child_process');
const utils = require('@graphql-tools/utils');

const createLoadError = (error) => new Error('Unable to load file from git: ' + error);
const createCommand = ({ ref, path }) => {
    return `git show ${ref}:${path}`;
};
/**
 * @internal
 */
async function loadFromGit(input) {
    try {
        return await new Promise((resolve, reject) => {
            child_process.exec(createCommand(input), { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 1024 }, (error, stdout) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(stdout);
                }
            });
        });
    }
    catch (error) {
        throw createLoadError(error);
    }
}
/**
 * @internal
 */
function loadFromGitSync(input) {
    try {
        return child_process.execSync(createCommand(input), { encoding: 'utf-8' });
    }
    catch (error) {
        throw createLoadError(error);
    }
}

/**
 * @internal
 */
function parse({ path, pointer, content, options, }) {
    if (/\.(gql|graphql)s?$/i.test(path)) {
        return utils.parseGraphQLSDL(pointer, content, options);
    }
    if (/\.json$/i.test(path)) {
        return utils.parseGraphQLJSON(pointer, content, options);
    }
}

// git:branch:path/to/file
function extractData(pointer) {
    const parts = pointer.replace(/^git\:/i, '').split(':');
    if (!parts || parts.length !== 2) {
        throw new Error('Schema pointer should match "git:branchName:path/to/file"');
    }
    return {
        ref: parts[0],
        path: parts[1],
    };
}
/**
 * This loader loads a file from git.
 *
 * ```js
 * const typeDefs = await loadTypedefs('git:someBranch:some/path/to/file.js', {
 *   loaders: [new GitLoader()],
 * })
 * ```
 */
class GitLoader {
    loaderId() {
        return 'git-loader';
    }
    async canLoad(pointer) {
        return this.canLoadSync(pointer);
    }
    canLoadSync(pointer) {
        return typeof pointer === 'string' && pointer.toLowerCase().startsWith('git:');
    }
    async load(pointer, options) {
        const { ref, path } = extractData(pointer);
        const content = await loadFromGit({ ref, path });
        const parsed = parse({ path, options, pointer, content });
        if (parsed) {
            return parsed;
        }
        const rawSDL = await graphqlTagPluck.gqlPluckFromCodeString(pointer, content, options.pluckConfig);
        return {
            location: pointer,
            rawSDL,
        };
    }
    loadSync(pointer, options) {
        const { ref, path } = extractData(pointer);
        const content = loadFromGitSync({ ref, path });
        const parsed = parse({ path, options, pointer, content });
        if (parsed) {
            return parsed;
        }
        const rawSDL = graphqlTagPluck.gqlPluckFromCodeStringSync(pointer, content, options.pluckConfig);
        return {
            location: pointer,
            rawSDL,
        };
    }
}

exports.GitLoader = GitLoader;
//# sourceMappingURL=index.cjs.js.map
