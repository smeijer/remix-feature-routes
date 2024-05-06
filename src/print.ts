/* eslint-disable no-console */
import path from "node:path";

import { Route, RouteManifest } from "remix-custom-routes";

export function printRouteManifest(routes: RouteManifest) {
	// Helper function to generate the next parameter replacement letter
	let count = 0;
	function getNextLetter() {
		const quotient = Math.floor(count / 26);
		const remainder = count % 26;
		count++;
		return (
			String.fromCharCode("a".charCodeAt(0) + remainder) +
			(quotient > 0
				? String.fromCharCode("a".charCodeAt(0) + quotient - 1)
				: "")
		);
	}

	const replacements = new Map<string, string>();
	const routeData = Object.values(routes).map((route) => {
		let routePath = route.path || "";

		let r: Route | undefined = route;
		while (r?.parentId) {
			routePath = path.join(routes[r.parentId]?.path || ".", routePath || ".");
			r = routes[r.parentId];
		}

		const params: Record<string, string> = {};
		const exampleUrl = routePath.replace(/:\w+/g, (match) => {
			const replacement = replacements.get(match) || getNextLetter();
			replacements.set(match, replacement);
			params[match.slice(1)] = `'${replacement}'`;
			return replacement;
		});

		return {
			file: route.file,
			path: routePath === "." ? "" : routePath,
			params,
			exampleUrl: exampleUrl === "." ? "" : exampleUrl,
		};
	});

	// Calculate maximum lengths for alignment
	const longestFile = Math.max(...routeData.map((r) => r.file.length));
	const longestPath = Math.max(...routeData.map((r) => r.path?.length || 0));
	const longestURL = Math.max(
		...routeData.map((r) => r.exampleUrl?.length || 0),
	);

	// Construct output lines
	const padding = 4;
	const lines = routeData.map((route) => {
		const filePadded = route.file.padEnd(longestFile + padding, " ");
		const pathPadded = (
			typeof route.path === "string" ? `/${route.path}` : ""
		).padEnd(longestPath + padding, " ");
		const urlPadded = (
			typeof route.exampleUrl === "string" ? `/${route.exampleUrl}` : ""
		).padEnd(longestURL + padding, " ");

		const paramsString =
			Object.keys(route.params).length > 0
				? `{ ${Object.entries(route.params)
						.map(([k, v]) => `${k}: ${v}`)
						.join(", ")} }`
				: "";

		return `${filePadded} ${pathPadded} ${urlPadded} ${paramsString}`;
	});

	const longestLine = Math.max(...lines.map((x) => x.length));

	// Print the formatted table
	console.log(
		`${"ROUTE".padEnd(longestFile + padding, " ")} ${"URL".padEnd(
			longestPath + padding,
			" ",
		)} ${"EXAMPLE".padEnd(longestURL + padding, " ")} PARAMS`,
	);
	console.log("-".repeat(longestLine));
	console.log(lines.join("\n") + "\n");
}
