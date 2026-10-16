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
export default function Estimates({ items, onSave, store, Modal }) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState(null);
  const shown = items.filter(
    (a) =>
      (!store || a.store === store) &&
      (!status || a.status === status) &&
      `${a.name} ${a.phone} ${a.vehicleYear || ""} ${a.vehicleMake} ${a.vehicleModel} ${serviceName(a.service)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const active = items.find((a) => a._id === selected);
  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          aria-label="Search estimate requests"
          placeholder="Search name, phone, vehicle, or service"
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
          onClose={() => setSelected(null)}
          Modal={Modal}
        />
      )}
    </>
  );
}
function EstimateDialog({ request: a, onSave, onClose, Modal }) {
  const [status, setStatus] = useState(a.status),
    [staffNotes, setStaffNotes] = useState(a.staffNotes),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
      <a
        className="call-customer"
        href={"tel:" + a.phone.replace(/[^+\d]/g, "")}
      >
        Call customer
      </a>
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
          Internal notes stay in the staff portal. Contact the customer directly
          to discuss pricing; no automatic message is sent.
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
