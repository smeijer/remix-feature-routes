# remix-feature-routes

> remix router inspired by domain driven design

## Install

```sh
npm install remix-feature-routes
```

## Usage

```js
import { vitePlugin as remix } from "@remix-run/dev";
import { featureRoutes } from "remix-feature-routes";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		remix({
			// require to disable remix default routing algoritm
			ignoredRouteFiles: ["**/*"],
			routes: featureRoutes({
				// optional
				ignoredRouteFiles: [
					".*",
					"**/*.css",
					"**/*.test.{js,jsx,ts,tsx}",
					"**/__*.*",
					"**/internal/**",
				],
			}),
		}),
		tsconfigPaths(),
	],
});
```

Inside the routes folders, we use a 'flat files' convention. Use `$` for params, and `.` for `/`.

This will enable you to have a file structure like:

```shell
ROUTE                          URL
--------------------------------------------------
# Auth related code and routes
auth/actions/user-actions.ts
auth/config.ts #  export const routeConfig = { basePath: '/' }
auth/components/login-form.ts
auth/components/signup-form.ts
auth/models/user.ts
auth/routes/index.tsx          /auth
auth/routes/login.tsx          /auth/login
auth/routes/signup.tsx         /auth/signup
auth/routes/_layout.tsx        /auth

# Products related code and routes
products/routes/index.tsx      /products
products/routes/$id.tsx        /products/:id
products/routes/_layout.tsx    /products

# Users related code and routes
users/routes/settings.tsx      /users/settings
users/routes/profile.tsx       /users/profile
users/routes/index.tsx         /users
users/routes/_layout.tsx       /users
```

## Route config files

All domains can have an optional `config.ts` file, exporting a `routeConfig`. This way it's possible to change the path prefix.

By default, domains have their domain name prefixed. Using a basePath of `/` moves the routes to the root.

```ts
export const routeConfig = {
	basePath: "/",
};
```

We also support params in the basePath:

```ts
export const routeConfig = {
	basePath: "/$owner/$repo",
};

// repos/routes/index.tsx      /:owner/:repo
// repos/routes/issues.tsx     /:owner/:repo/issues
// repos/routes/pulls.tsx      /:owner/:repo/pulls
```

## API

### remix-feature-routes(options?)

Remix feature routes doesn't require any options, though you might want to add some files to ignore in case you're colocating stylesheets, or test files.

#### options

Type: `ignoredRouteFiles`
Default: `[]`

This property takes an array of glob strings. Define some globs to ensure that collocated test files are not seen as routes.
