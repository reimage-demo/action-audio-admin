# Action Audio — Staff portal

Live site: https://reimage-demo.github.io/action-audio-admin/

Public landing page for QR codes: https://reimage-demo.github.io/action-audio/landing-page.html

Source lives on main; GitHub Pages serves the compiled gh-pages branch.

## Local development and builds

```sh
npm ci
cp .env.example .env.local
npm run dev
# Build the deployable files:
npm run build
```

Publish only the contents of dist to the gh-pages branch. Never publish local environment or credential files.

Both sites use the existing Action Audio Convex deployment robust-stork-24 (development). No backend migration was performed for this frontend deployment. The public inventory retains the explicitly labeled manufacturer preview catalog. Staff authentication and customer data remain on Convex; no passwords or customer records are stored in this repository.
