# Publishing SLT-ERP Bridge to the browser stores

Goal: every user installs with one click from their browser's own store - no
Developer mode, no admin rights, no registry policy, and updates delivered by
the store itself. This replaces the abandoned enterprise force-install route
(Windows 11 denies standard users every policy key write, and there is no AD
domain to push policy from).

## 0. Build the upload packages

    npm run ext:store

writes to `dist/extension-store/` (git-ignored, rebuild any time):

- `slt-bridge-v<version>-chrome-cws.zip` - upload this to BOTH the Chrome Web
  Store and Edge Add-ons (Edge accepts Chromium packages as-is)
- `slt-bridge-v<version>-firefox.xpi` - upload to Firefox Add-ons (AMO)

## 1. Chrome Web Store (Chrome)

1. Register a developer account at the Chrome Web Store Developer Dashboard.
   One-time USD 5 registration fee - the only store that charges anything.
2. New item -> upload the `-chrome-cws.zip`. Visibility: **Unlisted** (anyone
   with the link can install; no public search listing).
3. Fill in permission justifications (reviewers require a reason for each
   broad permission):
   - `serviceportal.slt.lk` / `*.slt.lk` / cloudfront host permissions: reads
     service-order data from the SLT portal pages the user already has open.
   - `sltserp.vercel.app`: pushes captured data into the ERP.
   - `cookies`: reads the portal session cookie so sync resumes after login.
   - `tabs` / `activeTab`: detects open portal tabs. `alarms`: sync retries.
   - `storage`: caches last-sync state.
4. Review takes hours to a few days for unlisted items. Copy the item URL into
   `STORE_LINKS` in `src/app/extension-download/page.tsx` and deploy.

## 2. Edge Add-ons (Edge)

1. Register at Microsoft Partner Center (free).
2. Create new extension -> upload the same `-chrome-cws.zip`, visibility
   **Unlisted**. Same justifications as above.
3. Review typically 1-3 business days. Paste the item URL into `STORE_LINKS`.

## 3. Firefox (AMO, unlisted - automated)

1. Register a Mozilla account on addons.mozilla.org (free), then create API
   keys under Tools -> Manage API Keys. Put them in `.env` (git-ignored) as
   `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` - never in the repo.
2. Sign through the AMO API (web-ext, unlisted channel, no dashboard clicks):

       npm run ext:amo

   This stages the Firefox sources, submits them to AMO, downloads the signed
   package and copies it to `public/downloads/SLT-Bridge-Firefox.xpi`. The
   first run also creates the unlisted add-on on the AMO account.
3. Commit + deploy the signed file. The Firefox button on
   `/extension-download` already points at `/downloads/SLT-Bridge-Firefox.xpi`;
   clicking it in Firefox (or opening the downloaded file) installs
   permanently with a normal prompt - no Developer mode, no admin rights.
4. Re-signs of the same version are rejected ("version already exists"):
   bump the manifest version before every re-release.

## 4. Point the ERP page at the stores

`STORE_LINKS` at the top of `src/app/extension-download/page.tsx` renders one
button per store, but only once its `url` is non-empty. Paste each item URL
after its review passes; the "Store publication in progress" notice disappears
automatically once the first link is live. The manual zip download stays as a
fallback for the interim.

## Notes

- Store item IDs will NOT match the self-hosted id
  `mhbnhnpammnagfmgomcpakeeohbnkajm` - expected. The ERP detects the bridge via
  DOM attributes (`data-slt-bridge`), never by extension id.
- If a store validator objects to the `http://localhost:3000/*` entries, strip
  them in a throwaway copy of the package used for upload only - do not remove
  them from `public/slt-bridge/manifest.json` (local development needs them).
- Version bump cycle: edit `public/slt-bridge/manifest.json`, then
  `npm run ext:store` (store packages) and `npm run ext:pack` (self-hosted
  `.crx` + updates.xml, still deployed for anyone on the old policy install).
