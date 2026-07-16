import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, type WhatsAppAccount } from "../../lib/api";

import { StepIndicator, WhatsAppAccountCard, WhatsAppSetupWizardContent } from "./page";

describe("WhatsApp setup experience", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders accessible progress and the line naming step", () => {
    const onLineNameChange = vi.fn();

    render(
      <WhatsAppSetupWizardContent
        currentStep={1}
        isPending={false}
        lineName=""
        onContinue={vi.fn()}
        onLineNameChange={onLineNameChange}
        qrWaitTimedOut
      />
    );

    expect(screen.getByText("Step 1 of 3 — Name your line")).toBeTruthy();
    expect(screen.getByRole("img", { name: "WhatsApp setup progress: step 1 of 3" })).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. Site Dispatch")).toBeTruthy();
    expect(screen.getByText(/dedicated business number/)).toBeTruthy();
    expect(screen.getByText(/Having trouble/)).toBeTruthy();
  });

  it("renders plain-language QR instructions without exposing the status enum", () => {
    render(
      <WhatsAppSetupWizardContent
        currentStep={2}
        isPending={false}
        lineName="Site Dispatch"
        onContinue={vi.fn()}
        qr="test-qr-value"
      />
    );

    expect(screen.getByText("Step 2 of 3 — Connect your phone")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Scan this code with WhatsApp" })).toBeTruthy();
    expect(screen.getByText("Open WhatsApp on your phone")).toBeTruthy();
    expect(screen.getByText(/Linked Devices/)).toBeTruthy();
    expect(screen.queryByText("PENDING_QR")).toBeNull();
  });

  it("renders the connecting step without exposing the status enum", () => {
    render(
      <WhatsAppSetupWizardContent
        currentStep={3}
        isPending={false}
        lineName="Site Dispatch"
        onContinue={vi.fn()}
      />
    );

    expect(screen.getByText("Step 3 of 3 — Finishing up")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Connecting" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Connecting your WhatsApp..." })).toBeTruthy();
    expect(screen.queryByText("CONNECTING")).toBeNull();
  });

  it("shows the connected account banner and confirmation-protected disconnect action", async () => {
    vi.spyOn(api, "listWhatsAppChats").mockResolvedValue({ chats: [] });
    const disconnect = vi.spyOn(api, "disconnectWhatsAppAccount").mockResolvedValue({
      account: whatsappAccount({ status: "DISCONNECTED" })
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderAccount(whatsappAccount(), { qr: null, status: "CONNECTING" });

    expect(await screen.findByRole("heading", { name: "WhatsApp connected" })).toBeTruthy();
    expect(screen.getByText(/Site Dispatch · Connected/)).toBeTruthy();
    expect(screen.queryByText("CONNECTED")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("shows a friendly retry action when the connection fails", async () => {
    const connect = vi.spyOn(api, "connectWhatsAppAccount").mockResolvedValue({
      account: whatsappAccount({ status: "PENDING_QR" })
    });

    renderAccount(whatsappAccount({ status: "ERROR" }));

    expect(screen.getByText("Connection failed. Please try scanning the code again.")).toBeTruthy();
    expect(screen.queryByText("ERROR")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(connect).toHaveBeenCalledOnce());
  });

  it("marks completed setup steps with a checkmark", () => {
    render(<StepIndicator currentStep={3} />);

    const progress = screen.getByRole("img", {
      name: "WhatsApp setup progress: step 3 of 3"
    });
    expect(progress.querySelectorAll("svg")).toHaveLength(2);
  });
});

function renderAccount(
  account: WhatsAppAccount,
  cachedQr?: { qr: string | null; status: WhatsAppAccount["status"] }
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  if (cachedQr) {
    client.setQueryData(["whatsapp-qr", account.id], cachedQr);
  }

  return render(
    <QueryClientProvider client={client}>
      <WhatsAppAccountCard
        account={account}
        canManage
        organizationId="organization-1"
        projects={[]}
      />
    </QueryClientProvider>
  );
}

function whatsappAccount(overrides: Partial<WhatsAppAccount> = {}): WhatsAppAccount {
  return {
    connectorType: "BAILEYS",
    createdAt: "2026-07-15T00:00:00.000Z",
    displayName: "Site Dispatch",
    id: "whatsapp-account-1",
    lastConnectedAt: "2026-07-15T01:00:00.000Z",
    lastDisconnectedAt: null,
    lastMessageAt: null,
    organizationId: "organization-1",
    phoneNumber: "+65 6000 0000",
    sessionKey: "session-key",
    status: "CONNECTED",
    updatedAt: "2026-07-15T01:00:00.000Z",
    ...overrides
  };
}
