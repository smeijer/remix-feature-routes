/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	transform: {
		// transform all ts files in src/
		'^.+\\.tsx?$': ['ts-jest', { useESM: true }],
	},
};
