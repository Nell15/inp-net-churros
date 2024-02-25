import nodeAdapter from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';

import { fileURLToPath } from 'node:url';
import preprocess from 'svelte-preprocess';

const adapter = process.env.BUILDING_FOR === 'mobile' ? staticAdapter : nodeAdapter;

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
    adapter: adapter({
      fallback: 'index.html',
    }),
  },
};

export default config;
