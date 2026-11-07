import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { estimateEmail } from "../shared/estimate-email.js";
import { useState } from "react";
import { serviceContent } from "../shared/service-content.js";
import { stores } from "../shared/catalog.js";
const labels = {
  new: "New request",
  contacted: "Contacted",
  quoted: "Estimate given",
  closed: "Closed",
};
const serviceName = (id) => serviceContent.find((s) => s.id === id)?.name || id;
const storeName = (id) => stores.find((s) => s.id === id)?.name || id;
const received = (at) =>
  new Date(at).toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function Estimates({
  items,
  onSave,
  onSend,
  usage,
  demo,
  store,
  Modal,
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState(null);
  const shown = items.filter(
    (a) =>
      (!store || a.store === store) &&
      (!status || a.status === status) &&
      `${a.name} ${a.email || ""} ${a.phone} ${a.vehicleYear || ""} ${a.vehicleMake} ${a.vehicleModel} ${serviceName(a.service)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const active = items.find((a) => a._id === selected);
  return (
    <>
      <p className="notice">
        {demo
          ? "Preview mode — no emails are sent."
          : usage?.enabled
            ? `${usage.used} of ${usage.limit} email attempts in the last 24 hours. Thank-you emails and estimates share this limit. Extra messages wait in the queue.`
            : "Email delivery is awaiting Brevo setup. Messages remain safely queued."}
      </p>
      <div className="toolbar">
        <input
          type="search"
          aria-label="Search estimate requests"
          placeholder="Search name, email, phone, vehicle, or service"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter estimates by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All estimate requests</option>
          {Object.entries(labels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <section className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Vehicle</th>
              <th>Service / location</th>
              <th>Received</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a._id}>
                <td>
                  <strong>{a.name}</strong>
                  {a.email && <small>{a.email}</small>}
                  <a href={"tel:" + a.phone.replace(/[^+\d]/g, "")}>
                    {a.phone}
                  </a>
                </td>
                <td>
                  {a.vehicleYear} {a.vehicleMake}
                  <small>{a.vehicleModel}</small>
                </td>
                <td>
                  {serviceName(a.service)}
                  <small>{storeName(a.store)}</small>
                </td>
                <td>
                  {received(a.createdAt)}
                  <small>Eastern</small>
                </td>
                <td>
                  <span className={"status estimate-" + a.status}>
                    {labels[a.status]}
                  </span>
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => setSelected(a._id)}
                  >
                    View request
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && (
          <div className="empty">
            <h3>No matching estimate requests.</h3>
            <p>
              Requests from the website appear here with the customer’s service,
              vehicle, and callback number.
            </p>
          </div>
        )}
      </section>
      {active && (
        <EstimateDialog
          key={active._id}
          request={active}
          onSave={onSave}
          onSend={onSend}
          demo={demo}
          onClose={() => setSelected(null)}
          Modal={Modal}
        />
      )}
    </>
  );
}
function EstimateDialog({ request: a, onSave, onSend, demo, onClose, Modal }) {
  const [status, setStatus] = useState(a.status),
    [staffNotes, setStaffNotes] = useState(a.staffNotes),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [composing, setComposing] = useState(false);
  if (composing)
    return (
      <EmailComposer
        request={a}
        onSend={onSend}
        demo={demo}
        Modal={Modal}
        onClose={() => setComposing(false)}
      />
    );
  return (
    <Modal title="Estimate request" onClose={onClose}>
      <span className="status">{labels[a.status]}</span>
      <h3 className="detail-name">{a.name}</h3>
      <p>
        {a.vehicleYear} {a.vehicleMake} {a.vehicleModel} {a.vehicleTrim}
      </p>
      <dl className="detail-grid">
        <div>
          <dt>Service</dt>
          <dd>{serviceName(a.service)}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{storeName(a.store)}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>
            <a href={"tel:" + a.phone.replace(/[^+\d]/g, "")}>{a.phone}</a>
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>
            {a.email || "Not provided — add it when sending an estimate."}
          </dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd>{received(a.createdAt)} ET</dd>
        </div>
      </dl>
      <section className="estimate-intake-summary">
        <h3>Project details</h3>
        <p style={{ whiteSpace: "pre-wrap" }}>
          {a.details || "No additional project details provided."}
        </p>
        <dl className="detail-grid">
          {(a.answers || []).map((answer) => (
            <div key={answer.id}>
              <dt>{answer.label}</dt>
              <dd>{answer.value}</dd>
            </div>
          ))}
          {a.budget && (
            <div>
              <dt>Budget</dt>
              <dd>{a.budget}</dd>
            </div>
          )}
          {a.timing && (
            <div>
              <dt>Timing / best time to call</dt>
              <dd>{a.timing}</dd>
            </div>
          )}
        </dl>
      </section>
      <div className="estimate-contact-actions">
        <a
          className="call-customer"
          href={"tel:" + a.phone.replace(/[^+\d]/g, "")}
        >
          Call customer
        </a>
        <button
          type="button"
          className="send-estimate-button"
          onClick={() => setComposing(true)}
        >
          Send email
        </button>
      </div>
      {!demo && <EmailHistory id={a._id} />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave({ id: a._id, status, staffNotes });
          } catch (err) {
            setError(err.data || err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Request status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(labels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Internal notes
          <textarea
            value={staffNotes}
            onChange={(e) => setStaffNotes(e.target.value)}
            maxLength="2000"
            rows="4"
            placeholder="Record the options discussed, approximate price, and next step."
          />
        </label>
        <small>
          Internal notes stay in the staff portal. Use Send email to share an
          estimate with the customer.
        </small>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy}>
          {busy ? "Saving…" : "Save estimate update"}
        </button>
      </form>
    </Modal>
  );
}

const deliveryLabel = {
  pending: "Queued — waiting to send",
  sending: "Sending",
  sent: "Sent — accepted by Brevo",
  failed: "Not sent — check Brevo configuration",
  review: "Delivery uncertain — check Brevo logs before sending again",
};
function EmailHistory({ id }) {
  const messages = useQuery(api.emails.history, { id });
  const retry = useMutation(api.emails.retry);
  const [retrying, setRetrying] = useState(null),
    [error, setError] = useState("");
  return (
    <section className="email-history" aria-label="Email history">
      <h3>Email history</h3>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!messages ? (
        <p>Loading emails…</p>
      ) : !messages.length ? (
        <p>No emails yet.</p>
      ) : (
        messages.map((m) => (
          <details key={m.id}>
            <summary>
              {m.kind === "thanks" ? "Thank-you email" : "Estimate email"} ·{" "}
              {deliveryLabel[m.status]}
            </summary>
            <p>
              {m.email} · {received(m.sentAt || m.createdAt)} ET
            </p>
            {m.errorCode === "daily_limit" ||
            m.errorCode === "brevo_credit_buffer" ? (
              <p>Waiting for available daily email capacity.</p>
            ) : null}
            {m.body && <p className="email-message-body">{m.body}</p>}
            {m.status === "failed" && (
              <button
                type="button"
                disabled={Boolean(retrying)}
                onClick={async () => {
                  setRetrying(m.id);
                  setError("");
                  try {
                    await retry({ id: m.id });
                  } catch (err) {
                    setError(err.data || err.message);
                  } finally {
                    setRetrying(null);
                  }
                }}
              >
                {retrying === m.id ? "Queueing…" : "Retry email"}
              </button>
            )}
          </details>
        ))
      )}
    </section>
  );
}
function EmailComposer({ request, onSend, demo, Modal, onClose }) {
  const [email, setEmail] = useState(request.email || "");
  const [body, setBody] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [queued, setQueued] = useState(false);
  const preview = estimateEmail({
    ...request,
    kind: "estimate",
    body:
      body ||
      "Type your estimate below. Your message will appear here with Action Audio branding.",
  });
  return (
    <Modal
      title="Send an estimate email"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {queued ? (
        <div role="status">
          <h3>{demo ? "Preview complete" : "Email queued"}</h3>
          <p>
            {demo
              ? "No email was sent."
              : `Your estimate to ${email} is queued for delivery. Email history shows when Brevo accepts it. Messages wait automatically if the daily limit is reached.`}
          </p>
          <button onClick={onClose}>Back to request</button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              if (!demo)
                await onSend({ id: request._id, email, body, requestKey });
              setQueued(true);
            } catch (err) {
              setError(
                err.data ||
                  err.message ||
                  "Unable to queue email. Your draft is still here.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            To
            <input
              type="email"
              value={email}
              maxLength={254}
              required
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <p className="email-subject">
            <strong>Subject:</strong> {preview.subject}
          </p>
          <label>
            Your estimate
            <textarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              minLength={10}
              maxLength={10000}
              required
              disabled={busy}
              placeholder="Describe the recommended work, estimated price, what’s included, and the next step."
            />
          </label>
          <p className="estimate-help">
            The greeting, Action Audio branding, and store contact details are
            included automatically. Customers can reply directly to the store.
          </p>
          <details className="email-preview" open>
            <summary>Branded email preview</summary>
            <iframe
              title="Action Audio estimate email preview"
              sandbox=""
              srcDoc={preview.htmlContent}
            />
          </details>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "Queueing…" : demo ? "Preview send" : "Send email"}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
        </form>
      )}
    </Modal>
  );
}
