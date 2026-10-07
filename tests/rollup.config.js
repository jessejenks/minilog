import typescript from "@rollup/plugin-typescript";
import fs from "node:fs";
import path from "node:path";

const TESTS_DIR = "./tests";
const tests = Object.fromEntries(
	fs
		.readdirSync(TESTS_DIR, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
		.map((entry) => {
			const filePath = path.join(entry.parentPath, entry.name);
			const { dir, name } = path.parse(path.relative(TESTS_DIR, filePath));
			return [path.join(dir, name), filePath];
		}),
);

export default {
	external: [/^node:/],
	input: tests,
	output: [
		{
			dir: "dist/tests",
			format: "cjs",
			entryFileNames: "[name].cjs",
			chunkFileNames: "[name]-[hash].cjs",
		},
	],
	plugins: [typescript({ tsconfig: "./tests/tsconfig.json" })],
};
