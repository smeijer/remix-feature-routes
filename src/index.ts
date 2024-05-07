import fs from 'node:fs';
import path from 'node:path';

import { cosmiconfig as Cosmiconfig } from 'cosmiconfig';
import { findUp } from 'find-up';
import { type GlobOptions, globSync } from 'glob';
import { ensureRootRouteExists, getRouteIds, getRouteManifest } from 'remix-custom-routes';

import { loadJs, loadTs } from './config.js';
import { printRouteManifest } from './print.js';

const ignoreDomains = new Set(['shared']);

const cosmiconfig = Cosmiconfig('remix-feature-routes', {
	loaders: {
		'.mjs': loadJs,
		'.cjs': loadJs,
		'.js': loadJs,
		'.ts': loadTs,
	},
});

function getDomains(appDir: string) {
	return fs
		.readdirSync(appDir, { withFileTypes: true })
		.filter((x) => x.isDirectory())
		.filter((x) => !ignoreDomains.has(x.name))
		.filter((x) =>
			fs
				.lstatSync(path.join(appDir, x.name, 'routes'), {
					throwIfNoEntry: false,
				})
				?.isDirectory(),
		)
		.map((x) => x.name);
}

export type RouteConfig = {
	basePath: string;
};

async function getRouteConfig(domain: string): Promise<RouteConfig> {
	// TODO: need some more testing, but ideally we dont' use cosmiconfig for this
	//   thing is, dynamic import from vite use globs and error often, require doesnt work
	//   and this takes time to get right.
	//   Also, cosmiconfig.load works, but calling loadTS directly does not, while the args
	//   are the same.
	const config: RouteConfig = {
		basePath: domain,
	};

	if (fs.existsSync(`./app/${domain}/config.ts`)) {
		const loaded = await cosmiconfig.load(`./app/${domain}/config.ts`);
		Object.assign(config, loaded?.config);
	}

	if (config.basePath === '/') {
		config.basePath = `_${domain}`;
	} else {
		config.basePath = normalizeId(config.basePath);
	}

	return config;
}

function normalizeId(id: string) {
	return id.replace(/^\//, '').replaceAll('/', '.');
}

/**
 * Mutates the routeId array to our domain convention
 */
async function parseRouteIds(domain: string, routeIds: Array<[string, string]>) {
	const routeConfig = await getRouteConfig(domain);

	for (const route of routeIds) {
		route[1] = path.join(domain, route[1]);
		const basename = path.basename(route[0]);

		const id = `${routeConfig.basePath}.${basename}`;
		const segments = id.split('.');
		for (let idx = 0; idx < segments.length; idx++) {
			const segment = segments[idx]!;
			if (segment === '_layout') {
				segments[idx] = '';
			} else if (segment === 'index') {
				segments[idx] = `_${segment}`;
			} else if (segment === '_') {
				segments[idx - 1] = `${segments[idx - 1]}_`;
				segments[idx] = '';
			} else {
				segments[idx] = segment;
			}
		}

		route[0] = segments.filter(Boolean).join('.');
	}
}

type Options = {
	ignoredRouteFiles?: GlobOptions['ignore'];
	root?: string;
};

export function featureRoutes(options?: Options) {
	return async function routes() {
		const root = path.dirname((await findUp('package.json')) || process.cwd());
		const appDirectory = path.join(root, 'app');
		ensureRootRouteExists(appDirectory);

		const domains = getDomains(appDirectory);
		const routeIds: [string, string][] = [];

		for (const domain of domains) {
			const files = globSync('routes/**/*.{js,jsx,ts,tsx,md,mdx}', {
				cwd: path.join(appDirectory, domain),
				ignore: options?.ignoredRouteFiles,
			});

			if (!files.length) continue;

			// array of tuples [routeId, filePath]
			const domainRoutes = getRouteIds(files, {
				indexNames: ['index'],
			}) as unknown as [string, string][];

			await parseRouteIds(domain, domainRoutes);
			routeIds.push(...domainRoutes);
		}

		// re-sort, as ids might have changed
		routeIds.sort(([a], [b]) => b.length - a.length);

		const manifest = getRouteManifest(routeIds);

		if (process.env['DEBUG_FEATURE_ROUTES']) {
			printRouteManifest(manifest);
		}

		return manifest;
	};
}
