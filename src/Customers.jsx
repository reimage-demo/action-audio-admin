import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { stores } from "../shared/catalog.js";
import { serviceContent } from "../shared/service-content.js";
import {
  promotionTemplates,
  promotionEmail,
  customerEligibility,
  validatePromotion,
} from "../shared/promotions.js";
import { demoCustomers } from "./customer-demo";
const serviceName = (id) => serviceContent.find((s) => s.id === id)?.name || id;
const date = (n) =>
  n
    ? new Date(n).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
const labels = {
  subscribed: "Subscribed",
  unknown: "Permission unknown",
  unsubscribed: "Unsubscribed",
};
const contentOf = (t) => ({
  template: t.id,
  subject: t.subject,
  headline: t.headline,
  offer: t.offer,
  body: t.body,
  button: t.button,
  url: t.url,
  store: t.store,
  expires: t.expires,
  terms: t.terms,
});
const errorText = (e) =>
  typeof e.data === "string"
    ? e.data
    : e.message || "Something went wrong. Please try again.";
export function LiveCustomers(props) {
  const customers = useQuery(api.customers.list),
    campaigns = useQuery(api.campaigns.list),
    settings = useQuery(api.campaigns.settings);
  const update = useMutation(api.customers.update),
    backfill = useMutation(api.customers.backfill),
    save = useMutation(api.campaigns.save),
    queue = useMutation(api.campaigns.queue),
    sendTest = useMutation(api.campaigns.sendTest),
    refresh = useMutation(api.campaigns.refresh),
    cancel = useMutation(api.campaigns.cancel);
  if (!customers || !campaigns || !settings)
    return <p role="status">Loading customers…</p>;
  return (
    <Customers
      {...props}
      items={customers}
      campaigns={campaigns}
      settings={settings}
      onUpdate={update}
      onSave={save}
      onQueue={queue}
      onTest={sendTest}
      onRefresh={refresh}
      onCancel={cancel}
      onBackfill={async () => {
        for (const table of ["appointments", "estimates"]) {
          let cursor = null;
          do {
            const page = await backfill({ table, cursor });
            if (page.done) break;
            cursor = page.cursor;
          } while (cursor);
        }
      }}
    />
  );
}
export function DemoCustomers(props) {
  const [items, setItems] = useState(demoCustomers),
    [campaigns, setCampaigns] = useState([]);
  return (
    <Customers
      {...props}
      demo
      items={items}
      campaigns={campaigns}
      settings={{ enabled: false, available: 240, reserve: 50 }}
      onUpdate={async ({ id, confirmDetails, evidence, ...updates }) =>
        setItems((rows) =>
          rows.map((c) =>
            c._id === id
              ? {
                  ...c,
                  ...updates,
                  conflicts: confirmDetails ? [] : c.conflicts,
                  consent: {
                    at: Date.now(),
                    source: "Preview",
                    text: evidence,
                  },
                }
              : c,
          ),
        )
      }
      onSave={async (args) => {
        const id = args.id || args.key;
        const revision =
          (campaigns.find((c) => c.id === id)?.revision || 0) + 1;
        setCampaigns((rows) => [
          {
            ...args,
            id,
            status: "draft",
            revision,
            updatedAt: Date.now(),
          },
          ...rows.filter((c) => c.id !== id),
        ]);
        return { id, revision };
      }}
      onQueue={async ({ id }) =>
        setCampaigns((rows) =>
          rows.map((c) =>
            c.id === id
              ? { ...c, status: "preview", updatedAt: Date.now() }
              : c,
          ),
        )
      }
      onBackfill={async () => {}}
    />
  );
}
function SelectBox({ checked, mixed, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return <input {...props} ref={ref} type="checkbox" checked={checked} />;
}
function Customers({
  items,
  campaigns,
  settings,
  demo,
  store,
  Modal,
  onUpdate,
  onSave,
  onQueue,
  onTest,
  onRefresh,
  onCancel,
  onBackfill,
  appointments = [],
  estimates = [],
}) {
  const [search, setSearch] = useState(""),
    [subscription, setSubscription] = useState(""),
    [service, setService] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState(new Set()),
    [profile, setProfile] = useState(null),
    [composer, setComposer] = useState(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState(null);
  const shown = useMemo(
    () =>
      items
        .filter(
          (c) =>
            (!store || c.stores.includes(store)) &&
            (!service || c.services.includes(service)) &&
            (!subscription ||
              (subscription === "eligible"
                ? !customerEligibility(c)
                : c.marketingStatus === subscription)) &&
            `${c.name} ${c.email} ${c.phone} ${c.vehicles.join(" ")}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) => b.lastSeen - a.lastSeen),
    [items, store, service, subscription, search],
  );
  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [store, service, subscription, search]);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(shown.length / 10) - 1),
  );
  const visible = shown.slice(currentPage * 10, currentPage * 10 + 10),
    picked = items.filter((c) => selected.has(c._id)),
    eligible = picked.filter((c) => !customerEligibility(c));
  const allPage =
    visible.length > 0 && visible.every((c) => selected.has(c._id));
  const change = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  async function act(fn) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const customer = items.find((c) => c._id === profile);
  return (
    <div className="customers-workspace">
      <div className="customer-intro">
        <div>
          <p className="eyebrow">YOUR CUSTOMER COMMUNITY</p>
          <h2>Keep every connection.</h2>
          <p>Appointments and estimate requests, together in one place.</p>
        </div>
        <button
          className="text-button"
          disabled={busy || demo}
          onClick={() =>
            act(async () => {
              await onBackfill();
              setMessage(
                "Existing appointments and estimates have been imported. No emails were sent.",
              );
            })
          }
        >
          {busy ? "Working…" : "Import existing requests"}
        </button>
      </div>
      {demo ? (
        <p className="notice">
          Local preview · Fictional customers. Drafts stay in this session. No
          emails are sent.
        </p>
      ) : !settings.enabled ? (
        <p className="notice">
          You can save drafts. Live promotions are disabled until the email
          sender and campaign connection are ready.
        </p>
      ) : (
        <p className="notice">
          {settings.available} promotional emails available now. Capacity is
          reserved for customer estimate emails.
        </p>
      )}
      <div className="customer-summary">
        <div>
          <strong>{items.length}</strong>
          <span>Saved customers</span>
        </div>
        <div>
          <strong>{items.filter((c) => !customerEligibility(c)).length}</strong>
          <span>Ready for promotions</span>
        </div>
        <div>
          <strong>
            {items.filter((c) => c.sources.includes("estimate")).length}
          </strong>
          <span>Estimate leads</span>
        </div>
        <div>
          <strong>{campaigns.length}</strong>
          <span>Drafts & campaigns</span>
        </div>
      </div>
      <div className="toolbar customer-filters">
        <input
          type="search"
          aria-label="Search customers"
          placeholder="Search name, email, phone, or vehicle"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter marketing permission"
          value={subscription}
          onChange={(e) => setSubscription(e.target.value)}
        >
          <option value="">All subscriptions</option>
          <option value="eligible">Ready for promotions</option>
          {Object.entries(labels).map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter customer service"
          value={service}
          onChange={(e) => setService(e.target.value)}
        >
          <option value="">All service interests</option>
          {serviceContent.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div
        className="customer-selection"
        role="region"
        aria-label="Customer selection"
      >
        <span aria-live="polite">
          <strong>{picked.length} selected</strong> · {eligible.length} eligible
          {picked.length > eligible.length
            ? ` · ${picked.length - eligible.length} excluded`
            : ""}
        </span>
        <div>
          <button
            type="button"
            className="text-button"
            disabled={!shown.length}
            onClick={() => setSelected(new Set(shown.map((c) => c._id)))}
          >
            Select all {shown.length} matching customers
          </button>
          <button
            className="text-button"
            disabled={!picked.length}
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
          <button
            disabled={!picked.length}
            onClick={() =>
              setComposer({ customerIds: picked.map((c) => c._id) })
            }
          >
            Create promotion
          </button>
        </div>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <section className="panel table-scroll">
        <table className="customer-table">
          <thead>
            <tr>
              <th className="selection-column">
                <SelectBox
                  aria-label="Select customers on this page"
                  checked={allPage}
                  mixed={!allPage && visible.some((c) => selected.has(c._id))}
                  disabled={!visible.length}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const c of visible)
                        allPage ? next.delete(c._id) : next.add(c._id);
                      return next;
                    })
                  }
                />
              </th>
              <th>Customer</th>
              <th>Vehicle & interest</th>
              <th>Source</th>
              <th>Promotional emails</th>
              <th>Last request</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr
                key={c._id}
                className={selected.has(c._id) ? "customer-selected" : ""}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${c.name}`}
                    checked={selected.has(c._id)}
                    onChange={() => change(c._id)}
                  />
                </td>
                <td>
                  <strong>{c.name}</strong>
                  <small>{c.email || "No email on file"}</small>
                  <small>{c.phone}</small>
                </td>
                <td>
                  {c.vehicles[0]}
                  {c.vehicles.length > 1 && (
                    <small>+{c.vehicles.length - 1} more vehicles</small>
                  )}
                  <small>{c.services.map(serviceName).join(", ")}</small>
                </td>
                <td>
                  <span className="customer-source">
                    {c.sources.includes("appointment") ? "Appointment" : ""}
                    {c.sources.length > 1 ? " + " : ""}
                    {c.sources.includes("estimate") ? "Estimate" : ""}
                  </span>
                  <small>
                    {c.stores
                      .map((s) => stores.find((x) => x.id === s)?.name)
                      .join(" · ")}
                  </small>
                </td>
                <td>
                  <span className={`status permission-${c.marketingStatus}`}>
                    {labels[c.marketingStatus]}
                  </span>
                  {customerEligibility(c) && (
                    <small>{customerEligibility(c)}</small>
                  )}
                </td>
                <td>{date(c.lastSeen)}</td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => setProfile(c._id)}
                  >
                    View customer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <div className="empty">
            <h3>No matching customers.</h3>
            <p>
              New appointments and estimates are saved here automatically. Use
              Import existing requests for older records.
            </p>
          </div>
        )}
      </section>
      <div className="customer-pagination">
        <span>
          {shown.length
            ? `${currentPage * 10 + 1}–${Math.min(currentPage * 10 + 10, shown.length)} of ${shown.length} customers`
            : "0 customers"}
        </span>
        <div>
          <button
            className="text-button"
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <button
            className="text-button"
            disabled={(currentPage + 1) * 10 >= shown.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </div>
      <section className="customer-campaigns">
        <div className="customer-section-heading">
          <div>
            <p className="eyebrow">STAY IN TOUCH</p>
            <h2>Promotions & drafts</h2>
          </div>
          <span>Choose customers above to start a campaign.</span>
        </div>
        {!campaigns.length ? (
          <div className="promotion-teasers">
            {promotionTemplates.map((t) => (
              <article key={t.id}>
                <span>
                  {t.id === "remote-start"
                    ? "01"
                    : t.id === "audio"
                      ? "02"
                      : t.id === "detail-tint"
                        ? "03"
                        : "04"}
                </span>
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <button
                  className="text-button"
                  disabled={!picked.length}
                  onClick={() =>
                    setComposer({
                      customerIds: picked.map((c) => c._id),
                      content: contentOf(t),
                    })
                  }
                >
                  Use template
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Promotion</th>
                  <th>Audience</th>
                  <th>Status</th>
                  <th>Results</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.content.subject}</strong>
                      <small>{date(c.updatedAt)}</small>
                    </td>
                    <td>{c.customerIds.length} selected</td>
                    <td>
                      <span className="status">
                        {c.status === "preview"
                          ? "Preview complete"
                          : c.status === "completed"
                            ? "Submitted to Brevo"
                            : c.status === "review"
                              ? "Needs review"
                              : c.status}
                      </span>
                      {c.error && <small>{c.error}</small>}
                    </td>
                    <td>
                      {c.totals
                        ? `${c.totals.delivered} delivered · ${c.totals.bounced} bounced · ${c.totals.unsubscribed} unsubscribed`
                        : c.status === "preview"
                          ? "No emails sent"
                          : "No delivery report yet"}
                    </td>
                    <td>
                      <div className="estimate-row-actions">
                        {c.status === "draft" ? (
                          <button
                            className="text-button"
                            onClick={() => setComposer(c)}
                          >
                            Edit draft
                          </button>
                        ) : (
                          <button
                            className="text-button"
                            onClick={() => setHistory(c)}
                          >
                            View campaign
                          </button>
                        )}
                        {!demo && c.status !== "draft" && (
                          <button
                            className="text-button"
                            disabled={busy || !settings.enabled}
                            onClick={() =>
                              act(async () => {
                                await onRefresh({ id: c.id });
                                setMessage(
                                  "Delivery report refresh requested.",
                                );
                              })
                            }
                          >
                            Refresh results
                          </button>
                        )}
                        {!demo && c.status === "queued" && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => act(() => onCancel({ id: c.id }))}
                          >
                            Stop remaining sends
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {customer && (
        <CustomerProfile
          key={customer._id}
          customer={customer}
          appointments={appointments}
          estimates={estimates}
          onSave={onUpdate}
          Modal={Modal}
          onClose={() => setProfile(null)}
          demo={demo}
        />
      )}
      {composer && (
        <PromotionComposer
          key={composer.id || "new"}
          initial={composer}
          customers={items}
          demo={demo}
          settings={settings}
          Modal={Modal}
          onClose={() => setComposer(null)}
          onSave={onSave}
          onQueue={onQueue}
          onTest={onTest}
          campaigns={campaigns}
        />
      )}
      {history && (
        <Modal title="Campaign details" onClose={() => setHistory(null)}>
          <p>{history.content.subject}</p>
          <iframe
            className="promotion-frame"
            sandbox=""
            title="Sent promotion preview"
            srcDoc={promotionEmail(history.content).htmlContent}
          />
          {demo ? (
            <p>No emails were sent in this preview.</p>
          ) : (
            <CampaignRecipients id={history.id} customers={items} />
          )}
        </Modal>
      )}
    </div>
  );
}
function CustomerProfile({
  customer: c,
  onSave,
  onClose,
  Modal,
  appointments,
  estimates,
  demo,
}) {
  const [name, setName] = useState(c.name),
    [phone, setPhone] = useState(c.phone),
    [status, setStatus] = useState(c.marketingStatus),
    [evidence, setEvidence] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const visits = appointments.filter(
    (a) => a.customerId === c._id || (demo && a.email === c.email),
  );
  const requests = estimates.filter(
    (a) => a.customerId === c._id || (demo && a.email === c.email),
  );
  return (
    <Modal
      title="Customer details"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>{c.email || "No email on file"}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            await onSave({
              id: c._id,
              name,
              phone,
              marketingStatus: status,
              evidence,
              confirmDetails: confirm,
            });
            setMessage("Customer saved.");
          } catch (err) {
            setMessage(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
          />
        </label>
        <label>
          Phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            minLength={10}
            maxLength={30}
          />
        </label>
        <label>
          Marketing permission
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(labels).map(([v, l]) => (
              <option
                key={v}
                value={v}
                disabled={
                  (v === "subscribed" && c.blocked) ||
                  (v === "unknown" && c.marketingStatus === "unsubscribed")
                }
              >
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Permission notes
          <textarea
            rows={3}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            required={
              status === "subscribed" && c.marketingStatus !== "subscribed"
            }
            minLength={
              status === "subscribed" && c.marketingStatus !== "subscribed"
                ? 10
                : undefined
            }
            maxLength={1000}
            placeholder="When and how did the customer agree to promotional emails?"
          />
        </label>
        {c.consent && (
          <p className="estimate-help">
            Last recorded: {date(c.consent.at)} · {c.consent.source}
            <br />
            {c.consent.text}
          </p>
        )}
        {c.conflicts.length > 0 && (
          <div className="notice">
            <p>
              {c.conflicts.join(". ")}. Compare their requests before sending
              promotions.
            </p>
            <label className="customer-checkbox">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              I reviewed the requests and confirmed these contact details.
            </label>
          </div>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <button disabled={busy}>{busy ? "Saving…" : "Save customer"}</button>
      </form>
      <section className="customer-request-history">
        <h3>Vehicles & requests</h3>
        <p>{c.vehicles.join(" · ")}</p>
        {visits.map((a) => (
          <p key={a._id}>
            <strong>Appointment · {serviceName(a.service)}</strong>
            <br />
            {a.date} · {a.status} · {a.name} · {a.phone}
          </p>
        ))}
        {requests.map((a) => (
          <p key={a._id}>
            <strong>Estimate · {serviceName(a.service)}</strong>
            <br />
            {date(a.createdAt)} · {a.status} · {a.name} · {a.phone}
          </p>
        ))}
        {!visits.length && !requests.length && (
          <p>
            This customer is saved independently of their original requests.
          </p>
        )}
      </section>
    </Modal>
  );
}
function CampaignRecipients({ id, customers }) {
  const rows = useQuery(api.campaigns.history, { id });
  return (
    <div>
      <h3>Recipient history</h3>
      {!rows ? (
        <p>Loading…</p>
      ) : (
        rows.map((r) => (
          <p key={r._id}>
            {customers.find((c) => c._id === r.customerId)?.name || "Customer"}{" "}
            · {r.deliveryStatus || r.status}
            {r.reason ? ` — ${r.reason}` : ""}
          </p>
        ))
      )}
    </div>
  );
}
function TestStatus({ id }) {
  const status = useQuery(api.campaigns.testStatus, { id });
  return (
    <p role="status">
      Test email:{" "}
      {status === "submitted"
        ? "Accepted by Brevo; check the test inbox."
        : status === "review"
          ? "Delivery uncertain. Check Brevo before trying again."
          : status || "Queued"}
    </p>
  );
}
function PromotionComposer({
  initial,
  customers,
  demo,
  settings,
  Modal,
  onClose,
  onSave,
  onQueue,
  onTest,
  campaigns,
}) {
  const [content, setContent] = useState(
      initial.content || contentOf(promotionTemplates[0]),
    ),
    [id, setId] = useState(initial.id),
    [reviewedRevision, setReviewedRevision] = useState(initial.revision),
    [key] = useState(() => crypto.randomUUID()),
    [step, setStep] = useState("edit"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [testEmail, setTestEmail] = useState(""),
    [testId, setTestId] = useState(null),
    [testPreview, setTestPreview] = useState(false);
  const testKey = useRef(crypto.randomUUID());
  const people = customers.filter((c) => initial.customerIds.includes(c._id));
  const eligible = people.filter((c) => !customerEligibility(c));
  const missing = initial.customerIds.length - people.length;
  const excluded = people.filter((c) => customerEligibility(c));
  const reasons = excluded.reduce((all, c) => {
    const r = customerEligibility(c);
    all[r] = (all[r] || 0) + 1;
    return all;
  }, {});
  if (missing) reasons["Customer no longer exists"] = missing;
  const change = (k, v) => {
    setContent((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
    setTestPreview(false);
    setTestId(null);
    testKey.current = crypto.randomUUID();
  };
  const validation = validatePromotion(content);
  const rendered = validation ? null : promotionEmail(content);
  async function saveDraft() {
    const result = await onSave({
      id,
      key,
      content,
      customerIds: initial.customerIds,
    });
    setId(result.id);
    setReviewedRevision(result.revision);
    setSaved(true);
    return result.id;
  }
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={
        step === "done"
          ? demo
            ? "Promotion preview complete"
            : "Promotion queued"
          : "Create a promotion"
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {step === "done" ? (
        <div className="promotion-done">
          <h3>
            {demo
              ? "Your campaign is ready to review."
              : "Your promotion is in the queue."}
          </h3>
          <p>
            {demo
              ? `Previewed for ${eligible.length} eligible customers. No emails were sent.`
              : "Batches send as capacity becomes available. Follow the campaign history for submission and delivery results."}
          </p>
          <button onClick={onClose}>Back to customers</button>
        </div>
      ) : (
        <>
          <div className="promotion-steps">
            <span className={step === "edit" ? "active" : ""}>
              1 · Design & preview
            </span>
            <span className={step === "review" ? "active" : ""}>
              2 · Review recipients
            </span>
          </div>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {step === "edit" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action(async () => {
                  await saveDraft();
                  setStep("review");
                });
              }}
            >
              <fieldset className="promotion-fields" disabled={busy}>
                <div
                  className="promotion-template-picker"
                  aria-label="Choose promotion template"
                >
                  {promotionTemplates.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      className={content.template === t.id ? "selected" : ""}
                      onClick={() => {
                        setContent(contentOf(t));
                        testKey.current = crypto.randomUUID();
                        setSaved(false);
                        setTestPreview(false);
                        setTestId(null);
                      }}
                    >
                      <strong>{t.name}</strong>
                      <small>{t.description}</small>
                    </button>
                  ))}
                </div>
                <label>
                  Email subject
                  <input
                    required
                    maxLength={150}
                    value={content.subject}
                    onChange={(e) => change("subject", e.target.value)}
                  />
                </label>
                <div className="promotion-editor-grid">
                  <label>
                    Headline
                    <input
                      required
                      maxLength={160}
                      value={content.headline}
                      onChange={(e) => change("headline", e.target.value)}
                    />
                  </label>
                  <label>
                    Offer or announcement
                    <input
                      required
                      maxLength={180}
                      value={content.offer}
                      onChange={(e) => change("offer", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Message
                  <textarea
                    required
                    rows={6}
                    maxLength={6000}
                    value={content.body}
                    onChange={(e) => change("body", e.target.value)}
                  />
                </label>
                <div className="promotion-editor-grid">
                  <label>
                    Button text
                    <input
                      required
                      maxLength={80}
                      value={content.button}
                      onChange={(e) => change("button", e.target.value)}
                    />
                  </label>
                  <label>
                    Button destination
                    <input
                      required
                      type="url"
                      value={content.url}
                      onChange={(e) => change("url", e.target.value)}
                    />
                  </label>
                  <label>
                    Featured store
                    <select
                      value={content.store}
                      onChange={(e) => change("store", e.target.value)}
                    >
                      <option value="both">Both stores</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Offer ends (optional)
                    <input
                      type="date"
                      value={content.expires}
                      onChange={(e) => change("expires", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Offer details and exclusions
                  <textarea
                    rows={2}
                    maxLength={1500}
                    value={content.terms}
                    onChange={(e) => change("terms", e.target.value)}
                  />
                </label>
                {rendered ? (
                  <details open className="email-preview">
                    <summary>Action Audio email preview</summary>
                    <iframe
                      title="Promotion email preview"
                      sandbox=""
                      srcDoc={rendered.htmlContent}
                    />
                  </details>
                ) : (
                  <p className="notice">{validation}</p>
                )}
                <div className="promotion-test">
                  <label>
                    Send a test to
                    <input
                      type="email"
                      placeholder="Your email address"
                      value={testEmail}
                      onChange={(e) => {
                        setTestEmail(e.target.value);
                        setTestId(null);
                        testKey.current = crypto.randomUUID();
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-button"
                    disabled={
                      busy ||
                      Boolean(validation) ||
                      (!demo && (!settings.enabled || !testEmail))
                    }
                    onClick={() =>
                      action(async () => {
                        if (demo) {
                          setTestPreview(true);
                          return;
                        }
                        const draftId = await saveDraft();
                        const result = await onTest({
                          id: draftId,
                          email: testEmail,
                          key: testKey.current,
                        });
                        setTestId(result);
                      })
                    }
                  >
                    {demo ? "Preview test email" : "Send test email"}
                  </button>
                  {testPreview && (
                    <p role="status">
                      Test preview ready above. No email was sent.
                    </p>
                  )}
                  {testId && !demo && <TestStatus id={testId} />}
                </div>
                <div className="promotion-footer">
                  <span role="status">
                    {saved
                      ? "Draft saved."
                      : `${initial.customerIds.length} customers selected`}
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || Boolean(validation)}
                    onClick={() => action(saveDraft)}
                  >
                    Save draft
                  </button>
                  <button disabled={busy || Boolean(validation)}>
                    {busy ? "Saving…" : "Review recipients"}
                  </button>
                </div>
              </fieldset>
            </form>
          ) : (
            <div className="promotion-review">
              <h3>{content.subject}</h3>
              <div className="customer-summary">
                <div>
                  <strong>{initial.customerIds.length}</strong>
                  <span>Selected</span>
                </div>
                <div>
                  <strong>{eligible.length}</strong>
                  <span>Eligible recipients</span>
                </div>
                <div>
                  <strong>{excluded.length + missing}</strong>
                  <span>Excluded</span>
                </div>
              </div>
              {Object.entries(reasons).map(([reason, n]) => (
                <p key={reason}>
                  {n} · {reason}
                </p>
              ))}
              <details>
                <summary>Review the recipient list</summary>
                <ul>
                  {people.map((c) => (
                    <li key={c._id}>
                      {c.name} · {c.email || "No email"}
                      {customerEligibility(c)
                        ? ` — excluded: ${customerEligibility(c)}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </details>
              <p>
                Each customer receives their own copy. Email addresses are not
                shared with other recipients. Unsubscribed and blocked contacts
                are checked again before sending.
              </p>
              {!demo && !settings.enabled && (
                <p className="notice">
                  Live sending is disabled. Your draft is saved for when the
                  campaign connection is ready.
                </p>
              )}
              {eligible.length > settings.available && (
                <p className="notice">
                  This audience exceeds today’s available capacity. Remaining
                  batches will wait for more capacity.
                </p>
              )}
              {demo && (
                <p className="notice">
                  Preview only. This will not send email.
                </p>
              )}
              <div className="promotion-footer">
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setStep("edit")}
                >
                  Back to edit
                </button>
                <button
                  disabled={
                    busy ||
                    !eligible.length ||
                    (!demo && (!settings.enabled || !reviewedRevision))
                  }
                  onClick={() =>
                    action(async () => {
                      await onQueue({
                        id,
                        revision: reviewedRevision,
                        eligibleCount: eligible.length,
                      });
                      setStep("done");
                    })
                  }
                >
                  {busy
                    ? "Queueing…"
                    : demo
                      ? `Preview campaign for ${eligible.length}`
                      : `Send promotion to ${eligible.length} customers`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
