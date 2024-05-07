/* eslint-disable @typescript-eslint/no-require-imports,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-base-to-string */

/**
 * Took parts from cosmiconfig loaders from the url below, because they don't
 * support named exports
 *
 * https://github.com/cosmiconfig/cosmiconfig/blob/main/src/loaders.ts
 * https://github.com/cosmiconfig/cosmiconfig/issues/308
 */
import { Loader, LoaderSync } from 'cosmiconfig';
import { existsSync } from 'fs';
import { rm, writeFile } from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';

const require = createRequire(import.meta.url);

let importFresh: typeof import('import-fresh');
export const loadJsSync: LoaderSync = function loadJsSync(filepath) {
	if (importFresh === undefined) {
		importFresh = require('import-fresh');
	}

	return importFresh(filepath);
};

export const loadJs: Loader = async function loadJs(filepath) {
	try {
		const { href } = pathToFileURL(filepath);
		const mod = await import(href);
		return mod.routeConfig;
	} catch (error) {
		try {
			return loadJsSync(filepath, '').routeConfig;
		} catch (requireError: any) {
			if (
				requireError.code === 'ERR_REQUIRE_ESM' ||
				(requireError instanceof SyntaxError &&
					requireError.message.includes('Cannot use import statement outside a module'))
			) {
				throw error;
			}

			throw requireError;
		}
	}
};

let typescript: typeof import('typescript');
export const loadTs: Loader = async function loadTs(filepath, content = '') {
	if (typescript === undefined) {
		typescript = (await import('typescript')).default;
	}
	const compiledFilepath = `${filepath.slice(0, -2)}mjs`;
	let transpiledContent;
	try {
		try {
			const config = resolveTsConfig(path.dirname(filepath)) ?? {};
			config.compilerOptions = {
				...config.compilerOptions,
				module: typescript.ModuleKind.ES2022,
				moduleResolution: typescript.ModuleResolutionKind.Bundler,
				target: typescript.ScriptTarget.ES2022,
				noEmit: false,
			};
			transpiledContent = typescript.transpileModule(content, config).outputText;
			await writeFile(compiledFilepath, transpiledContent);
		} catch (error: any) {
			error.message = `TypeScript Error in ${filepath}:\n${error.message}`;
			throw error;
		}
		// eslint-disable-next-line @typescript-eslint/return-await
		return await loadJs(compiledFilepath, transpiledContent);
	} finally {
		if (existsSync(compiledFilepath)) {
			await rm(compiledFilepath);
		}
	}
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveTsConfig(directory: string): any {
	const filePath = typescript.findConfigFile(directory, (fileName) => {
		return typescript.sys.fileExists(fileName);
	});
	if (filePath !== undefined) {
		const { config, error } = typescript.readConfigFile(filePath, (path) => typescript.sys.readFile(path));
		if (error) {
			throw new Error(`Error in ${filePath}: ${error.messageText.toString()}`);
		}
		return config;
	}
	return;
}
