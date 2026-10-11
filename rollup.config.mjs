import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default {
	input: 'src/sky-ajax.ts',
	output: [
		{ file: 'dist/sky-ajax.mjs', format: 'esm', sourcemap: false }
	],
	plugins: [
		resolve(),
		typescript({
			tsconfig: './tsconfig.build.json',
		}),
	],
};
