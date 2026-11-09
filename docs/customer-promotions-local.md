# Customers and promotions

The initial implementation was built and tested locally. The release includes the customer directory, intake capture, historical import, and campaign drafts. Live promotional sending stays disabled until the Brevo campaign connection is configured and verified. Brevo interactions have been tested with mocked HTTP responses; no real promotional email has been sent.

## Preview

Run `VITE_CONVEX_URL='' npm run dev -w admin -- --port 5175`, then visit `http://127.0.0.1:5175/admin/?preview=customers`. The preview override is only available in Vite development mode. It bypasses Convex entirely and uses 18 fictional customer profiles. Changes persist while navigating the current portal session, and reset on a browser refresh.

Try page selection, Select all matching customers, the subscription/service filters, customer permission edits, any of the four templates, draft save/reopen, test preview, and the final recipient review. The demo's final action simulates sending and labels the campaign Preview complete. It does not make network calls to Brevo.

## Data and behavior

- `convex/lib/customers.ts` creates encrypted customer profiles in the same database transaction as appointment/estimate intake. Identity is normalized email; missing-email legacy requests use normalized phone plus name. Distinct emails are not merged based only on a shared phone number.
- Conflicting names or phone numbers flag a profile for review without silently overwriting established details. The original request shows its submitted details in customer history. Staff can confirm corrected contact details.
- `customerId` links each request to its saved profile. Estimate deletion preserves the independent profile and service/vehicle summary. Customer contact fields and consent evidence remain encrypted.
- `customers.backfill` is a manager-only, resumable, 50-record batch import. It links older records without re-enqueueing their emails. Run it for both source tables after backend deployment; the UI Import existing requests button handles the cursors. Re-running it safely skips linked requests.
- Public appointment and estimate forms have a separate unchecked optional marketing checkbox. Existing customers without permission remain Unknown. New submissions never re-subscribe an unsubscribed or provider-blocked address. Staff permission changes require evidence when switching to Subscribed.
- Directory search, store/service/permission filters, 10-row pages, page-level selection, explicit selection across all matching pages, and excluded-recipient counts are implemented. Changing filters clears selection. Campaigns are capped at 5,000 selected IDs per draft to bound each snapshot.
- The promotion composer includes four editable templates, safe Action Audio HTTPS button links, both store addresses, verified Wethersfield phone details, expiry/terms, HTML escaping, and Brevo's unsubscribe placeholder. Templates contain no invented discounts or prices.

## Campaign backend

Drafts are encrypted. Queueing freezes the reviewed content revision and recipient IDs, deduplicates selection, and rechecks subscription/eligibility. Double-clicks do not create duplicate queues. Campaigns send through Brevo's marketing endpoints, using a separate recipient list for each batch; no CC/BCC recipient list is exposed.

Workers claim up to 50 recipients atomically. They share the existing `emailAttempts` ledger and leave 50 attempts below the app's 290 rolling-24-hour ceiling for transactional messages. Brevo account credits are checked too. Remaining recipients stay queued for the five-minute worker. Quota reservations are retained on failure. This protects sends made through this app; other software using the same Brevo account can still consume credits.

Workers check current customer eligibility before claiming and again before dispatch. They check Brevo contact blocklists and never clear the provider's opt-out flag. Expired offers stop before the next batch. Stop remaining sends cancels unsent recipients and refuses cancellation during an active batch. Already submitted campaigns cannot be recalled.

Provider acceptance is labeled Submitted, not Delivered. Refresh results retrieves aggregate campaign delivery/bounce/unsubscribe statistics. Authenticated marketing webhooks update per-recipient delivery status and customer suppression. An interrupted worker or ambiguous send result is marked Needs review, with no automatic resend. An operator must reconcile Brevo's logs before creating a replacement campaign. Provider campaign and list IDs are retained for that investigation. Lists are retained as campaign audit data; this release does not automatically delete them.

Test emails use a separate idempotent queue, one explicit recipient, the same quota ledger, and a 50-test-per-rolling-day cap. Failures/ambiguous results are reported for review. Real sending defaults to disabled.

## Configuration before enabling live promotional sending

Keep all credentials in Convex server environment variables, never `VITE_*` or source files:

- `PROMOTIONS_ENABLED`: omitted/false until integration is verified.
- `BREVO_MARKETING_API_KEY`: a dedicated key with Contacts, Email campaigns, and Account read permissions. The existing transactional key does not grant these permissions.
- `BREVO_MARKETING_FOLDER_ID`: existing Brevo contact folder to hold per-batch lists.
- `BREVO_PROMOTION_SENDER_EMAIL`: verified sender on `actionaudiostorellc.com`.
- `BREVO_REPLY_TO_EMAIL`: existing store inbox.
- `BREVO_MARKETING_WEBHOOK_SECRET`: random secret of at least 32 characters.

Configure a marketing webhook to `https://<deployment>.convex.site/brevo/marketing-events`, with custom header `x-action-audio-webhook-key` containing the secret. Subscribe to delivered, hardBounce, softBounce, unsubscribed, and spam. The endpoint rejects unauthenticated requests and accepts the documented snake_case event payloads; duplicate events do not resubscribe contacts or downgrade opt-outs to Delivered. Treat the webhook secret like an API key.

Deploy the backend first, run the backfill, and verify counts against both source tables before publishing the UI. The UI supports customer management and drafts while sending is disabled. Configure the dedicated key/sender/webhook and test a real recipient and unsubscribe before enabling live sending. No automatic account upgrades are implemented. Gmail controls tab placement; campaign delivery cannot guarantee Primary placement.

## Validation

`npm test` runs backend authorization, encrypted persistence, normalized-email deduplication, conflict handling, consent preservation, idempotent backfill, customer retention after deletion, campaign revision/recipient checks, quotas, batch splitting, ambiguous-send handling, provider suppression, webhook authentication, template escaping, and UI selection/editor/draft/review tests. `npm run typecheck`, `npm run build`, and `npm run seo:check` validate types and generated assets.

References: https://developers.brevo.com/reference/create-email-campaign, https://developers.brevo.com/reference/send-email-campaign-now, https://developers.brevo.com/reference/send-test-email, https://developers.brevo.com/docs/marketing-webhooks, https://developers.brevo.com/reference/create-webhook.
