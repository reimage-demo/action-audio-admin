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

Both live sites use the Action Audio production deployment standing-elephant-145. Local development can use robust-stork-24; do not point routine development or tests at production. Wethersfield handles electronics and remote starters; Hartford handles detailing. The booking API enforces these specialties. Customer tracking has four staff-confirmed stages with optional, explicitly labeled daily estimates capped within the current stage. Staff set statuses, customer notes, and target pickup dates in the appointment dialog. The Estimates tab receives service-specific customer requests with name, phone, make and model; the manager can call and record quotes. Exactly one manager login is supported, with no public signup or staff-account creation. The public electronics page uses labeled example models and original category illustrations. The design uses solid colors, self-hosted IBM Plex Sans, distinct service images and retouched showroom photographs. HTTP redirects to HTTPS. Staff authentication and customer data remain on Convex; no passwords or customer records are stored in this repository.
