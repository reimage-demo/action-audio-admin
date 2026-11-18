// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RestrictedPortal } from "../src/App.jsx";
afterEach(cleanup);
it("shows totals and keeps the popup in place without a close control", () => {
  const { container } = render(React.createElement(RestrictedPortal, { access: { estimates: 17, appointments: 8 } }));
  const dialog = screen.getByRole("alertdialog");
  expect(dialog.textContent).toBe("Please Contact 8602050115 to restore connection");
  expect(document.activeElement).toBe(dialog);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("17")).toBeTruthy();
  expect(screen.getByText("8")).toBeTruthy();
  expect(container.querySelector(".restricted-background")?.hasAttribute("inert")).toBe(true);
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.click(container.querySelector(".connection-overlay")!);
  expect(screen.getByRole("alertdialog")).toBe(dialog);
});
