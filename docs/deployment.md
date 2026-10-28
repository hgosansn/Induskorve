# GitHub Pages deployment

1. Use Node 24: `npm ci`, `npm run check`, `npm run build`.
2. In **Settings → Pages**, select **GitHub Actions**. Initial activation needs repository admin access; the workflow token cannot always enable Pages.
3. Merge the reviewed branch into `main`. `pages.yml` builds and uploads `dist/`, then deploys through the `github-pages` environment.
4. Verify the returned deployment URL. Repository setup alone is not proof of publication.

Build and PR jobs have `contents: read`; the Pages build also has `pages: read` for site configuration. Only the deploy job gets `pages: write` and `id-token: write`. Workflows do not change repository visibility, collaborators, branch/tag protections or releases.

Vite uses `base: './'`: hashed assets resolve under `/Induskorve/` and custom domains. There are no path routes needing a 404 fallback. `.nojekyll` is copied from `public/`; generated `dist/` is excluded from Git.

`VITE_*` variables are public. Never put tokens or server credentials in them. Pages hosts static files; SpacetimeDB needs a separate endpoint with HTTPS/WSS and reducer-side authorization.

Saves are scoped to browser origin, not repository. Repositories under the same Pages owner share an origin, so the new save key is namespaced. Changing hosts does not transfer local storage automatically.

Rollback through a source revert and redeployment. Save-schema changes require compatible migrations; never clear browser storage to force a rollback.
