import { publicPage, logoUrl } from "./site";
import { useState, useMemo, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { stores, services, statuses, statusLabels } from "../shared/catalog";
import { journeyProgress, progressStages } from "../shared/progress.js";
const storeName = (id) => stores.find((s) => s.id === id)?.name || id;
const serviceName = (id) => services.find((s) => s.id === id)?.name || id;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const dateLabel = (d) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
const tabs = [
  ["dashboard", "Overview"],
  ["appointments", "Appointments"],
  ["vehicles", "Vehicle status"],
  ["customers", "Customers"],
  ["inventory", "Electronics"],
  ["calendar", "Calendar"],
];
const sampleAppointments = [
  {
    _id: "demo-1",
    name: "Alex Morgan",
    email: "alex@example.com",
    phone: "(860) 555-0101",
    vehicle: "2022 Toyota Camry",
    service: "electronics-repair",
    store: "wethersfield",
    date: today(),
    time: "10:00",
    status: "in_progress",
    notes: "Audio system needs an electronics assessment.",
    trackingCode: "0".repeat(32),
    updates: [
      {
        status: "checked_in",
        message: "Vehicle checked in.",
        at: Date.now() - 7200000,
      },
      {
        status: "in_progress",
        message: "Electronics repair is underway.",
        at: Date.now() - 3600000,
      },
    ],
  },
  {
    _id: "demo-2",
    name: "Jordan Lee",
    email: "jordan@example.com",
    phone: "(860) 555-0102",
    vehicle: "2024 Honda CR-V",
    service: "auto-detailing",
    store: "hartford",
    date: today(),
    time: "13:00",
    status: "requested",
    notes: "Interested in auto detailing work.",
    trackingCode: "1".repeat(32),
    updates: [
      {
        status: "requested",
        message: "Request received.",
        at: Date.now() - 1800000,
      },
    ],
  },
  {
    _id: "demo-3",
    name: "Taylor Davis",
    email: "taylor@example.com",
    phone: "(860) 555-0103",
    vehicle: "2019 Ford F-150",
    service: "electrical-installation",
    store: "wethersfield",
    date: today(),
    time: "09:00",
    status: "ready",
    notes: "Vehicle electronics installation.",
    trackingCode: "2".repeat(32),
    updates: [
      {
        status: "ready",
        message: "Final checks are complete. Ready for pickup.",
        at: Date.now(),
      },
    ],
  },
];
const sampleInventory = [
  {
    _id: "demo-product",
    name: "Example component speaker system",
    brand: "Demo brand",
    category: "Speakers",
    description: "Fictional product for portal preview.",
    store: "wethersfield",
    availability: "in_stock",
    published: false,
  },
];
function Logo() {
  return <img className="brand-logo" src={logoUrl} alt="Action Audio" />;
}
function Login() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-shell">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            await signIn("password", {
              username: data.get("username"),
              password: data.get("password"),
              flow: "signIn",
            });
          } catch {
            setError(
              "Unable to sign in. Check your username, password, and staff access.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Logo />

        <h1>Welcome back.</h1>
        <p>Sign in to manage appointments, vehicle updates, and electronics.</p>
        <label>
          Username
          <input
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <a href={publicPage()}>Back to the website</a>
      </form>
    </div>
  );
}
export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading)
    return <div className="auth-shell">Loading your workspace…</div>;
  return isAuthenticated ? <Connected /> : <Login />;
}
function Connected() {
  const appointments = useQuery(api.appointments.list),
    inventory = useQuery(api.inventory.list);
  const updateStatus = useMutation(api.appointments.updateStatus),
    saveProduct = useMutation(api.inventory.save);
  const { signOut } = useAuthActions();
  if (!appointments || !inventory)
    return <div className="auth-shell">Loading your workspace…</div>;
  return (
    <Portal
      liveAppointments={appointments}
      liveInventory={inventory}
      updateStatus={updateStatus}
      saveProduct={saveProduct}
      signOut={signOut}
    />
  );
}
export function Portal({
  demo = false,
  liveAppointments,
  liveInventory,
  updateStatus,
  saveProduct,
  signOut,
}) {
  const [tab, setTab] = useState("dashboard"),
    [store, setStore] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState(null),
    [product, setProduct] = useState(null),
    [menu, setMenu] = useState(false),
    [message, setMessage] = useState(""),
    [previewAppointments, setPreviewAppointments] =
      useState(sampleAppointments),
    [previewInventory, setPreviewInventory] = useState(sampleInventory),
    [calendarDate, setCalendarDate] = useState(today());
  const appointments = demo ? previewAppointments : liveAppointments,
    inventory = demo ? previewInventory : liveInventory;
  const scoped = appointments.filter((a) => !store || a.store === store);
  const filtered = scoped.filter(
    (a) =>
      (!status || a.status === status) &&
      `${a.name} ${a.email} ${a.phone} ${a.vehicle} ${serviceName(a.service)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const active = selected ? appointments.find((a) => a._id === selected) : null;
  const customers = useMemo(() => {
    const grouped = new Map();
    for (const a of filtered) {
      const prior = grouped.get(a.email);
      if (prior) prior.visits.push(a);
      else grouped.set(a.email, { ...a, visits: [a] });
    }
    return [...grouped.values()];
  }, [filtered]);
  const stats = [
    [
      "New requests",
      scoped.filter((a) => a.status === "requested").length,
      "Awaiting confirmation",
    ],
    [
      "Vehicles in the shop",
      scoped.filter((a) =>
        [
          "checked_in",
          "in_progress",
          "waiting_parts",
          "quality_check",
        ].includes(a.status),
      ).length,
      "Active service",
    ],
    [
      "Ready for pickup",
      scoped.filter((a) => a.status === "ready").length,
      "Awaiting collection",
    ],
    [
      "Today’s appointments",
      scoped.filter((a) => a.date === today() && a.status !== "cancelled")
        .length,
      dateLabel(today()),
    ],
  ];
  function navigate(next) {
    setTab(next);
    setSearch("");
    setStatus("");
    setMenu(false);
  }
  async function onStatus(args) {
    if (demo)
      setPreviewAppointments((prev) =>
        prev.map((a) =>
          a._id === args.id
            ? {
                ...a,
                status: args.status,
                estimatedReadyDate: args.estimatedReadyDate || undefined,
                updates: [
                  ...a.updates,
                  {
                    status: args.status,
                    message: args.message,
                    at: Date.now(),
                  },
                ],
              }
            : a,
        ),
      );
    else await updateStatus(args);
    setMessage(
      demo
        ? "Preview updated. No customer was notified."
        : "Vehicle update saved. It is visible on the customer’s tracking page.",
    );
  }
  async function onSave(args) {
    if (demo) {
      setPreviewInventory((prev) =>
        args.id
          ? prev.map((p) => (p._id === args.id ? { ...args, _id: args.id } : p))
          : [{ ...args, _id: crypto.randomUUID() }, ...prev],
      );
    } else await saveProduct(args);
    setMessage(
      demo
        ? "Preview product saved for this session."
        : "Electronics saved. Published items are visible on the website.",
    );
    setProduct(null);
  }
  const table = (rows) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Customer / vehicle</th>
            <th>Service</th>
            <th>Store</th>
            <th>Appointment</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a._id}>
              <td>
                <strong>{a.name}</strong>
                <small>{a.vehicle}</small>
              </td>
              <td>{serviceName(a.service)}</td>
              <td>{storeName(a.store)}</td>
              <td>
                {dateLabel(a.date)}
                <small>{a.time} ET</small>
              </td>
              <td>
                <span className={"status status-" + a.status}>
                  {statusLabels[a.status]}
                </span>
              </td>
              <td>
                <button
                  className="text-button"
                  onClick={() => setSelected(a._id)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="empty">
          <h3>No appointments here yet.</h3>
          <p>
            New customer requests will appear here. Try changing your filters.
          </p>
        </div>
      )}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <button
          className="sidebar-close"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        >
          Close
        </button>
        <a href={publicPage()} className="sidebar-brand">
          <Logo />
        </a>
        <span className="workspace-label">STORE WORKSPACE</span>
        <nav aria-label="Admin navigation">
          {tabs.map(([id, label]) => (
            <button
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => navigate(id)}
            >
              {label}
              {id === "appointments" &&
                scoped.some((a) => a.status === "requested") && (
                  <b>{scoped.filter((a) => a.status === "requested").length}</b>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="store-mark">AA</div>
          <div>
            <strong>Action Audio</strong>
            <small>{demo ? "Preview workspace" : "Staff workspace"}</small>
          </div>
        </div>
        <a className="back-link" href={publicPage()}>
          View public website
        </a>
        {!demo && (
          <button className="signout" onClick={signOut}>
            Sign out
          </button>
        )}
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div>
            <button
              className="mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Toggle navigation"
              aria-expanded={menu}
            >
              ☰
            </button>
            <span>Workspace</span>
            <span className="header-divider">/</span>
            <strong>{tabs.find((t) => t[0] === tab)[1]}</strong>
          </div>
          <div className="header-right">
            {demo ? "Preview" : "Live workspace"}
            <span className="avatar">AA</span>
          </div>
        </header>
        {demo && (
          <div className="preview-banner">
            PREVIEW MODE · Fictional data. Changes are temporary and never reach
            customers.
          </div>
        )}
        <main className="workspace-content">
          <div className="page-top">
            <div>
              <span className="eyebrow">{today()}</span>
              <h1>
                {tab === "dashboard"
                  ? "Store overview"
                  : tabs.find((t) => t[0] === tab)[1]}
              </h1>
              <p>
                {
                  {
                    dashboard:
                      "Appointments and service activity across both stores.",
                    appointments:
                      "Review appointment requests and confirm customer visits.",
                    vehicles:
                      "Keep customers in the loop, from check-in to pickup.",
                    customers:
                      "Customer contact details and appointment history.",
                    inventory:
                      "Manage products and availability on your public website.",
                    calendar: "View appointments by date and location.",
                  }[tab]
                }
              </p>
            </div>
            <select
              aria-label="Filter by store"
              value={store}
              onChange={(e) => setStore(e.target.value)}
            >
              <option value="">All locations</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {message && (
            <div className="notice" role="status">
              {message}
              <button
                aria-label="Dismiss message"
                onClick={() => setMessage("")}
              >
                ×
              </button>
            </div>
          )}
          {tab === "dashboard" && (
            <>
              <div className="stat-grid">
                {stats.map(([title, num, sub], i) => (
                  <button
                    key={title}
                    className="stat-card"
                    onClick={() => {
                      navigate(
                        i === 1 || i === 2 ? "vehicles" : "appointments",
                      );
                      setStatus(i === 0 ? "requested" : i === 2 ? "ready" : "");
                    }}
                  >
                    <span>{title}</span>
                    <strong>{num}</strong>
                    <small>{sub}</small>
                  </button>
                ))}
              </div>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Today’s appointments</h2>
                    <p>Today’s scheduled visits.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("appointments")}
                  >
                    View all appointments
                  </button>
                </div>
                {table(scoped.filter((a) => a.date === today()))}
              </section>
              <div className="dashboard-bottom">
                <section className="panel compact">
                  <h2>Vehicle updates</h2>
                  <p>
                    When you change a vehicle’s status, the customer’s private
                    tracking page updates automatically.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("vehicles")}
                  >
                    Update a vehicle
                  </button>
                </section>
                <section className="panel compact">
                  <h2>Public electronics</h2>
                  <p>
                    {inventory.filter((p) => p.published).length} published
                    products across your stores. Add new arrivals and update
                    availability.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("inventory")}
                  >
                    Manage electronics
                  </button>
                </section>
              </div>
            </>
          )}
          {["appointments", "vehicles", "customers"].includes(tab) && (
            <>
              <div className="toolbar">
                <input
                  aria-label="Search customers and vehicles"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customer, vehicle, phone, or service…"
                />
                {tab !== "customers" && (
                  <select
                    aria-label="Filter by status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {statuses.map((s) => (
                      <option value={s} key={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {tab === "appointments" ? (
                <section className="panel">{table(filtered)}</section>
              ) : tab === "vehicles" ? (
                <div className="vehicle-grid">
                  {filtered
                    .filter(
                      (a) => !["completed", "cancelled"].includes(a.status),
                    )
                    .map((a) => (
                      <button
                        className="vehicle-card"
                        key={a._id}
                        onClick={() => setSelected(a._id)}
                      >
                        <div>
                          <span className={"status status-" + a.status}>
                            {statusLabels[a.status]}
                          </span>
                          <small>{storeName(a.store)}</small>
                        </div>
                        <h2>{a.vehicle}</h2>
                        <p>
                          {a.name} · {serviceName(a.service)}
                        </p>
                        <ServiceProgress appointment={a} compact />
                        <span className="text-button">Manage service</span>
                      </button>
                    ))}
                  {!filtered.some(
                    (a) => !["completed", "cancelled"].includes(a.status),
                  ) && (
                    <div className="empty">
                      No active vehicles match these filters.
                    </div>
                  )}
                </div>
              ) : (
                <div className="panel table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Vehicles</th>
                        <th>Appointments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c.email}>
                          <td>
                            <strong>{c.name}</strong>
                            <small>{c.email}</small>
                          </td>
                          <td>
                            <a href={"tel:" + c.phone.replace(/[^+\d]/g, "")}>
                              {c.phone}
                            </a>
                          </td>
                          <td>
                            {[...new Set(c.visits.map((a) => a.vehicle))].join(
                              ", ",
                            )}
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => setSelected(c._id)}
                            >
                              {c.visits.length} · Latest appointment
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!customers.length && (
                    <div className="empty">
                      No customers match these filters.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {tab === "inventory" && (
            <>
              <div className="toolbar">
                <input
                  type="search"
                  aria-label="Search electronics"
                  placeholder="Search products, brands, or categories…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  onClick={() =>
                    setProduct({
                      name: "",
                      brand: "",
                      category: "Speakers",
                      description: "",
                      store: store || "wethersfield",
                      availability: "in_stock",
                      published: false,
                      imageUrl: "",
                    })
                  }
                >
                  + Add product
                </button>
              </div>
              <section className="panel table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Store</th>
                      <th>Availability</th>
                      <th>Website</th>
                      <th>Price</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {inventory
                      .filter(
                        (p) =>
                          (!store || p.store === store) &&
                          `${p.name} ${p.brand} ${p.category}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((p) => (
                        <tr key={p._id}>
                          <td>
                            <strong>{p.name}</strong>
                            <small>
                              {p.brand} · {p.category}
                            </small>
                          </td>
                          <td>{storeName(p.store)}</td>
                          <td>
                            {
                              {
                                in_stock: "In stock",
                                order: "Available to order",
                                unavailable: "Unavailable",
                              }[p.availability]
                            }
                          </td>
                          <td>
                            <span className="status">
                              {p.published ? "Published" : "Draft"}
                            </span>
                          </td>
                          <td>
                            {p.price === undefined
                              ? "Ask for price"
                              : "$" + p.price.toFixed(2)}
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => setProduct(p)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!inventory.length && (
                  <div className="empty">
                    <h3>No products added.</h3>
                    <p>
                      Add a product, then publish it to make it visible on the
                      website.
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
          {tab === "calendar" && (
            <>
              <div className="toolbar">
                <label>
                  Appointment date
                  <input
                    type="date"
                    value={calendarDate}
                    onChange={(e) => setCalendarDate(e.target.value)}
                  />
                </label>
              </div>
              <section className="panel">
                <div className="panel-header">
                  <h2>
                    {calendarDate ? dateLabel(calendarDate) : "Select a date"}
                  </h2>
                  <span>Eastern time</span>
                </div>
                {table(scoped.filter((a) => a.date === calendarDate))}
              </section>
            </>
          )}
          <div className="workspace-footer">
            Action Audio <span>Hartford & Wethersfield · Since 1983</span>
          </div>
        </main>
      </div>
      {active && (
        <AppointmentDialog
          appointment={active}
          onClose={() => setSelected(null)}
          onSave={onStatus}
          demo={demo}
        />
      )}{" "}
      {product && (
        <ProductDialog
          product={product}
          onClose={() => setProduct(null)}
          onSave={onSave}
        />
      )}
    </div>
  );
}
function Modal({ title, onClose, children }) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <dialog
        open
        className="modal"
        aria-label={title}
        aria-modal="true"
        ref={(node) => {
          if (node && !node.dataset.focused) {
            node.dataset.focused = "true";
            node.querySelector("button")?.focus();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Tab") {
            const nodes = [
              ...e.currentTarget.querySelectorAll(
                "button,input,textarea,select,a[href]",
              ),
            ].filter((n) => !n.disabled);
            const first = nodes[0],
              last = nodes.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        {children}
      </dialog>
    </div>
  );
}
function AppointmentDialog({ appointment: a, onClose, onSave, demo }) {
  const [status, setStatus] = useState(a.status),
    [message, setMessage] = useState(""),
    [estimatedReadyDate, setEstimatedReadyDate] = useState(
      a.estimatedReadyDate || "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="Appointment details" onClose={onClose}>
      <span className={"status status-" + a.status}>
        {statusLabels[a.status]}
      </span>
      <ServiceProgress appointment={a} />
      <h3 className="detail-name">{a.name}</h3>
      <p>{a.vehicle}</p>
      <dl className="detail-grid">
        <div>
          <dt>Store</dt>
          <dd>{storeName(a.store)}</dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd>{serviceName(a.service)}</dd>
        </div>
        <div>
          <dt>Appointment</dt>
          <dd>
            {dateLabel(a.date)} · {a.time} ET
          </dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>
            <a href={"mailto:" + a.email}>{a.email}</a>
            <br />
            <a href={"tel:" + a.phone.replace(/[^+\d]/g, "")}>{a.phone}</a>
          </dd>
        </div>
      </dl>
      {a.notes && (
        <div className="customer-note">
          <strong>Customer notes</strong>
          <p>{a.notes}</p>
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave({ id: a._id, status, message, estimatedReadyDate });
            setMessage("");
          } catch (err) {
            setError(err.data || err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div
          className="milestone-actions"
          role="group"
          aria-label="Set service milestone"
        >
          {[
            ["confirmed", "Appointment"],
            ["in_progress", "In service"],
            ["quality_check", "Final checks"],
            ["ready", "Ready"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Service status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target pickup date · optional
          <input
            type="date"
            value={estimatedReadyDate}
            onChange={(e) => setEstimatedReadyDate(e.target.value)}
          />
        </label>
        <p className="estimate-help">
          A target date enables daily estimated percentages within the current
          stage. Only staff updates advance stages; parts holds pause the
          estimate. Clear the date to show milestone percentages only.
        </p>
        <label>
          Customer-facing update
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows="3"
            maxLength="1000"
            placeholder="e.g. Your installation is complete. We’re doing the final sound check."
          />
        </label>
        <small>
          This message is visible to the customer on their private tracking
          page.
        </small>
        {error && (
          <div role="alert" className="notice">
            {error}
          </div>
        )}
        <button disabled={busy}>
          {busy ? "Saving…" : "Save service update"}
        </button>
      </form>
      <h3 className="history-title">Service timeline</h3>
      <ol className="history">
        {[...a.updates].reverse().map((u, i) => (
          <li key={i}>
            <strong>{statusLabels[u.status]}</strong>
            <small>
              {new Date(u.at).toLocaleString("en-US", {
                timeZone: "America/New_York",
              })}{" "}
              ET
            </small>
            <p>{u.message}</p>
          </li>
        ))}
      </ol>
      {!demo && (
        <a
          className="text-button"
          href={publicPage("track.html#" + a.trackingCode)}
          target="_blank"
          rel="noreferrer"
        >
          Open customer tracking page
        </a>
      )}
    </Modal>
  );
}
function ProductDialog({ product: p, onClose, onSave }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={p._id ? "Edit product" : "Add a product"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = Object.fromEntries(new FormData(e.currentTarget));
          const args = {
            ...data,
            published: data.published === "on",
            ...(data.price !== ""
              ? { price: Number(data.price) }
              : { price: undefined }),
            ...(p._id ? { id: p._id } : {}),
          };
          try {
            await onSave(args);
          } catch (err) {
            setError(err.data || err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="full">
            Product name
            <input name="name" defaultValue={p.name} maxLength="140" required />
          </label>
          <label>
            Brand
            <input
              name="brand"
              defaultValue={p.brand}
              maxLength="80"
              required
            />
          </label>
          <label>
            Category
            <select name="category" defaultValue={p.category}>
              {[
                "Speakers",
                "Subwoofers",
                "Amplifiers",
                "Receivers",
                "Remote starters",
                "Security",
                "Accessories",
                "Motorcycle audio",
                "Video systems",
                "Power liftgates",
                "Radar detectors",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Store
            <select name="store" defaultValue="wethersfield">
              <option value="wethersfield">Wethersfield · Electronics</option>
            </select>
          </label>
          <label>
            Availability
            <select name="availability" defaultValue={p.availability}>
              <option value="in_stock">In stock</option>
              <option value="order">Available to order</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </label>
          <label>
            Price ($) · optional
            <input
              name="price"
              type="number"
              min="0"
              step=".01"
              defaultValue={p.price}
            />
          </label>
          <label className="full">
            Description
            <textarea
              name="description"
              defaultValue={p.description}
              maxLength="2000"
              rows="3"
            />
          </label>
          <label className="full">
            Product image URL · optional
            <input
              type="url"
              name="imageUrl"
              pattern="https://.*"
              placeholder="https://…"
              defaultValue={p.imageUrl}
            />
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            name="published"
            defaultChecked={p.published}
          />{" "}
          Publish on the website
        </label>
        <small>
          Uncheck to hide this item from the public electronics catalog.
        </small>
        {error && (
          <div role="alert" className="notice">
            {error}
          </div>
        )}
        <button disabled={busy}>{busy ? "Saving…" : "Save product"}</button>
      </form>
    </Modal>
  );
}

function ServiceProgress({ appointment, compact = false }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const progress = journeyProgress(appointment, now);
  return (
    <div className={"service-progress" + (compact ? " compact" : "")}>
      <div className="progress-summary">
        <strong>{progress.percent}%</strong>
        <span>
          {progress.paused
            ? "On hold"
            : progress.estimated
              ? "Estimated progress"
              : "Service milestone"}
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Service progress"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {progressStages.map((step, i) => (
          <span key={step.id} className={i <= progress.stage ? "done" : ""} />
        ))}
      </div>
      {!compact && (
        <>
          <ol className="admin-stages">
            {progressStages.map((step, i) => (
              <li
                key={step.id}
                className={i === progress.stage ? "current" : ""}
              >
                {step.label}
              </li>
            ))}
          </ol>
          <small>
            {progress.overdue
              ? "Target date passed — update the pickup estimate."
              : appointment.estimatedReadyDate
                ? `Target pickup: ${dateLabel(appointment.estimatedReadyDate)}`
                : "No pickup estimate set."}
          </small>
        </>
      )}
    </div>
  );
}
