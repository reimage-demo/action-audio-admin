// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RestrictedPortal } from "../src/App.jsx";
afterEach(cleanup);
beforeEach(() => { window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }); });
it("shows totals and keeps the popup in place without a close control", () => {
  const { container } = render(React.createElement(RestrictedPortal, { access: { estimates: 17, appointments: 8, dashboard: { stats: [["New requests", 3, "Awaiting confirmation"]], todayAppointments: [{ name: "Appointment Customer" }], publishedProducts: 2 } } }));
  const dialog = screen.getByRole("alertdialog");
  expect(dialog.textContent).toBe("Please Contact 8602050115 to restore connection");
  expect(document.activeElement).toBe(dialog);
  expect(dialog.querySelector("button")).toBeNull();
  expect(container.querySelector(".sidebar")).toBeTruthy();
  expect(container.querySelector(".workspace-header")).toBeTruthy();
  expect(screen.getByText("Store overview")).toBeTruthy();
  expect(screen.getByText("Appointment Customer")).toBeTruthy();
  expect(screen.getAllByText("17")[0]).toBeTruthy();
  expect(screen.getAllByText("8")[0]).toBeTruthy();
  expect(container.querySelector(".restricted-background")?.hasAttribute("inert")).toBe(true);
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.click(container.querySelector(".connection-overlay")!);
  expect(screen.getByRole("alertdialog")).toBe(dialog);
});
