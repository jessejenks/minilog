import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default {
	input: "src/index.ts",
	output: [
		{
			file: "dist/index.iife.js",
			format: "iife",
			name: "Minilog",
		},
		{
			file: "dist/index.mjs",
			format: "es",
		},
		{
			file: "dist/index.cjs",
			format: "cjs",
		},
	],
	plugins: [typescript(), terser()],
};
