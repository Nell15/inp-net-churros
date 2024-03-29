import adapter from '@sveltejs/adapter-node';
import { fileURLToPath } from 'node:url';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [
    preprocess({
      scss: {
        prependData: `@use "${fileURLToPath(
          new URL('src/design/variables.scss', import.meta.url),
        )}" as *;`,
      },
    }),
  ],

  kit: {
    adapter: adapter(),
  },
};

export default config;
