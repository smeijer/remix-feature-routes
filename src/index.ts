import fs from "node:fs";
import path from "node:path";

import { findUp } from "find-up";
import { type GlobOptions, globSync } from "glob";
import { dirname } from "path";
import {
	ensureRootRouteExists,
	getRouteIds,
	getRouteManifest,
} from "remix-custom-routes";
import { fileURLToPath } from "url";

import { printRouteManifest } from "./print.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ignoreDomains = new Set(["shared"]);

function getDomains(appDir: string) {
	return fs
		.readdirSync(appDir, { withFileTypes: true })
		.filter((x) => x.isDirectory())
		.filter((x) => !ignoreDomains.has(x.name))
		.filter((x) =>
			fs
				.lstatSync(path.join(appDir, x.name, "routes"), {
					throwIfNoEntry: false,
				})
				?.isDirectory(),
		)
		.map((x) => x.name);
}

type RouteConfig = {
	basePath: string;
};

async function getRouteConfig(
	appDirectory: string,
	domain: string,
): Promise<RouteConfig> {
	// this runs somewhere in node_modules/remix-feature-routes, we need import relative from it
	const domainDir = path.relative(
		__dirname,
		path.join(`${appDirectory}/${domain}`),
	);
	if (!fs.existsSync(`${domainDir}/config.ts`)) return { basePath: domain };

	// due to vite globbing, we can only use vars in the mid
	const config = await import(`./${domainDir}/config.ts`).then((x: unknown) =>
		typeof x === "object" &&
		x &&
		"routeConfig" in x &&
		typeof x.routeConfig === "object" &&
		x.routeConfig
			? (x.routeConfig as Partial<RouteConfig>)
			: ({} as Partial<RouteConfig>),
	);

	return {
		// _domain results in a 'pathless route', so it groups them without affecting pathname
		basePath: !config.basePath
			? domain
			: config.basePath === "/"
				? `_${domain}`
				: normalizeId(config.basePath),
	};
}

function normalizeId(id: string) {
	return id.replace(/^\//, "").replaceAll("/", ".");
}

/**
 * Mutates the routeId array to our domain convention
 */
async function parseRouteIds(
	appDirectory: string,
	domain: string,
	routeIds: Array<[string, string]>,
) {
	const routeConfig = await getRouteConfig(appDirectory, domain);

	for (const route of routeIds) {
		route[1] = path.join(domain, route[1]);
		const basename = path.basename(route[0]);

		if (basename === "_layout") {
			route[0] = `${routeConfig.basePath}`;
		} else if (basename === "index") {
			route[0] = `${routeConfig.basePath}._${route[0]}`;
		} else {
			route[0] = `${routeConfig.basePath}.${route[0]}`;
		}
	}

	// re-sort, as ids might have changed
	routeIds.sort(([a], [b]) => b.length - a.length);
}

type Options = {
	ignoredRouteFiles?: GlobOptions["ignore"];
	root?: string;
};

export function featureRoutes(options?: Options) {
	return async function routes() {
		const root = path.dirname((await findUp("package.json")) || process.cwd());
		const appDirectory = path.join(root, "app");
		ensureRootRouteExists(appDirectory);

		const domains = getDomains(appDirectory);
		const routeIds: [string, string][] = [];

		for (const domain of domains) {
			const files = globSync("routes/**/*.{js,jsx,ts,tsx,md,mdx}", {
				cwd: path.join(appDirectory, domain),
				ignore: options?.ignoredRouteFiles,
			});

			if (!files.length) continue;

			// array of tuples [routeId, filePath]
			const domainRoutes = getRouteIds(files, {
				indexNames: ["index"],
			}) as unknown as [string, string][];

			await parseRouteIds(appDirectory, domain, domainRoutes);
			routeIds.push(...domainRoutes);
		}

		const manifest = getRouteManifest(routeIds);

		if (process.env["DEBUG_FEATURE_ROUTES"]) {
			printRouteManifest(manifest);
		}

		return manifest;
	};
}
