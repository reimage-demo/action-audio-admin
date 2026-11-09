// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoCustomers } from "../src/Customers.jsx";
afterEach(cleanup);
function Modal({ title, children, onClose }: any) {
  return React.createElement(
    "div",
    { role: "dialog", "aria-label": title },
    React.createElement("button", { onClick: onClose }, "Close"),
    children,
  );
}
function setup() {
  return render(
    React.createElement(DemoCustomers, {
      Modal,
      store: "",
      appointments: [],
      estimates: [],
    }),
  );
}
describe("customer selection and promotion preview", () => {
  it("selects the current page, selects all pages explicitly, and clears selections when filters change", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByText("0 selected")).toBeTruthy();
    await user.click(
      screen.getByRole("checkbox", { name: "Select customers on this page" }),
    );
    expect(screen.getByText("10 selected")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Select customers on this page",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
    await user.click(
      screen.getByRole("button", { name: "Select all 18 matching customers" }),
    );
    expect(screen.getByText("18 selected")).toBeTruthy();
    await user.selectOptions(
      screen.getByLabelText("Filter marketing permission"),
      "eligible",
    );
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Select all 13 matching customers" }),
    ).toBeTruthy();
  });
  it("saves a draft, previews a test and reviews exclusions before simulating a campaign", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(
      screen.getByRole("button", { name: "Select all 18 matching customers" }),
    );
    await user.click(screen.getByRole("button", { name: "Create promotion" }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTitle("Promotion email preview")).toBeTruthy();
    await user.click(
      within(dialog).getByRole("button", { name: "Preview test email" }),
    );
    expect(
      within(dialog).getByText("Test preview ready above. No email was sent."),
    ).toBeTruthy();
    await user.click(
      within(dialog).getByRole("button", { name: "Review recipients" }),
    );
    expect(within(dialog).getByText("1 · Unsubscribed")).toBeTruthy();
    expect(
      within(dialog).getByText("1 · Missing or invalid email"),
    ).toBeTruthy();
    await user.click(
      within(dialog).getByRole("button", { name: "Preview campaign for 13" }),
    );
    expect(
      screen.getByText(
        "Previewed for 13 eligible customers. No emails were sent.",
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back to customers" }));
    expect(screen.getByText("Preview complete")).toBeTruthy();
  });
  it("reopens an edited draft and prevents unsafe button destinations", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByLabelText("Select Alex Morgan"));
    await user.click(screen.getByRole("button", { name: "Create promotion" }));
    const subject = screen.getByLabelText("Email subject");
    fireEvent.change(subject, { target: { value: "Our local preview offer" } });
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Edit draft" }));
    expect(
      (screen.getByLabelText("Email subject") as HTMLInputElement).value,
    ).toBe("Our local preview offer");
    fireEvent.change(screen.getByLabelText("Button destination"), {
      target: { value: "https://untrusted.example/" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Review recipients",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
