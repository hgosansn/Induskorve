import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'exclude-development-playtest',
      apply: 'build',
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.fileName === 'playtest.html')
            this.error('The development playtest must not be shipped.');
          if (output.type !== 'chunk') continue;
          const leaked = Object.keys(output.modules).find((id) =>
            /\/(features\/playtest\/|application\/playtest-store\.ts|domain\/city\/playtest\.ts|rendering\/canvas\/playtest-projection\.ts)/.test(
              id.replaceAll('\\', '/'),
            ),
          );
          if (leaked)
            this.error(
              `Development playtest imported into the product: ${leaked}`,
            );
        }
      },
    },
  ],
  // Relative assets work at /Induskorve/ and custom domains, with no router fallback.
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    rolldownOptions: {
      // Extra root HTML pages are development tools, never release entry points.
      input: fileURLToPath(new URL('./index.html', import.meta.url)),
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: 'validation',
              test: /node_modules[\\/]zod[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
});
