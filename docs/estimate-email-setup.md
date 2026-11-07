# Estimate email integration

The public estimate form requires an email address and tells customers their estimate will arrive by email. A submission saves the encrypted request and queues one branded thank-you message in the same transaction. Duplicate submissions do not create extra emails. Older requests without an email remain readable; staff can enter the recipient in the email composer.

In the admin portal: **Estimates → View request → Send email**. The customer, subject, greeting, Action Audio template, and store footer are filled in. Staff type the estimate, review the preview, and send. The email history distinguishes queued, sending, accepted by Brevo, failed, and uncertain outcomes. Brevo acceptance is not proof of inbox delivery. Only accepted estimate emails automatically set the request to Estimate given. Closed requests remain closed. Internal notes are never included in outgoing emails.

## Production configuration

Set these in the production Convex environment, never a frontend `VITE_*` variable or a committed file:

- `BREVO_API_KEY`: restricted Brevo API key with Transactional email All and Account Read permissions.
- `BREVO_SENDER_EMAIL`: `actionaudiostore@gmail.com` (verified in Brevo on November 7, 2026).
- `BREVO_REPLY_TO_EMAIL`: `actionaudiostore@gmail.com`.
- `BREVO_ENABLED`: `true` only after the key and sender have been checked.

The sender display name is Action Audio. The existing Gmail sender is verified; Brevo recommends an authenticated business-domain sender for deliverability. No new sender or DNS records have been created.

Leave development disabled. Keep the key server-side. Brevo’s prepared key expires November 7, 2027, or after 90 days of inactivity; arrange replacement before expiry. Key creation was approved on November 7, 2026. Brevo requires a six-digit email verification code before generation; that verification is pending.

Convex was deployed to production on November 7, 2026 with delivery disabled and sender/reply-to configured. Publish both frontends only after key verification. Enable delivery after configuration. Pending messages resume automatically. No historical customer emails are backfilled.

## Sending limits and recovery

All thank-you and staff estimate emails share a hard cap of **290 reserved send attempts per rolling 24 hours**. Atomic reservations prevent concurrent jobs from exceeding this cap. Failed or uncertain attempts also count conservatively. Each message has one recipient, with no CC/BCC. The worker also checks Brevo account credits and pauses when 10 or fewer remain. This is below the account’s 300-per-day plan limit; unrelated campaigns or other integrations are not controlled by this app.

A five-minute background job processes up to 25 ready messages. Daily-limit overflow stays queued until capacity returns. Account-check network errors and provider rate limits wait an hour. No credits or paid upgrades are purchased. Brevo configuration failures are visible to staff, who can retry confirmed-unsent messages after fixing the configuration.

A timeout or server failure after a send request can mean Brevo accepted the message. Those messages are marked **Delivery uncertain** and are not automatically resent. Check Brevo Transactional email logs before sending another message. Jobs left in Sending for more than ten minutes also require review. Brevo’s idempotency header supplies an additional duplicate safeguard; the app does not depend on its expiry period for recovery.

Email recipient and content snapshots use the existing authenticated encryption at rest. Only delivery status, record references, timestamps, and provider message IDs are unencrypted. Credentials and provider error bodies are not logged. The privacy notice describes Brevo’s role in delivery.

## Validation

Automated tests cover encrypted storage, authorization, input validation, deduplication, atomic capacity reservation, next-day resumption, provider credit buffer, successful acceptance, ambiguous failures, and HTML escaping. A local Safari preview verifies intake email copy and the branded composer. Live delivery still requires the configured key and an authorized test recipient.

Provider references: https://developers.brevo.com/reference/send-transac-email and https://developers.brevo.com/reference/get-account.
