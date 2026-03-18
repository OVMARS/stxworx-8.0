import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

// ── Constants ──────────────────────────────────────────────────────────
const CONTRACT = "escrow-multi-token-v7";
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!; // client
const wallet2 = accounts.get("wallet_2")!; // freelancer
const wallet3 = accounts.get("wallet_3")!; // unauthorized

// ── Helpers ────────────────────────────────────────────────────────────
function createStxProject(
  client: string,
  freelancer: string,
  m1: number,
  m2: number,
  m3: number,
  m4: number
) {
  return simnet.callPublicFn(
    CONTRACT,
    "create-project-stx",
    [Cl.principal(freelancer), Cl.uint(m1), Cl.uint(m2), Cl.uint(m3), Cl.uint(m4)],
    client
  );
}

function completeMilestone(freelancer: string, projectId: number, milestoneNum: number) {
  return simnet.callPublicFn(
    CONTRACT,
    "complete-milestone",
    [Cl.uint(projectId), Cl.uint(milestoneNum)],
    freelancer
  );
}

function releaseMilestoneStx(client: string, projectId: number, milestoneNum: number) {
  return simnet.callPublicFn(
    CONTRACT,
    "release-milestone-stx",
    [Cl.uint(projectId), Cl.uint(milestoneNum)],
    client
  );
}

function fileDispute(sender: string, projectId: number, milestoneNum: number) {
  return simnet.callPublicFn(
    CONTRACT,
    "file-dispute",
    [Cl.uint(projectId), Cl.uint(milestoneNum)],
    sender
  );
}

// ════════════════════════════════════════════════════════════════════════
// 1. Project Creation (STX)
// ════════════════════════════════════════════════════════════════════════
describe("Project Creation (STX)", () => {
  it("creates a 4-milestone project, returns id u1", () => {
    const { result } = createStxProject(wallet1, wallet2, 100_000, 100_000, 100_000, 100_000);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("verifies fee deduction (10% default)", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 100_000, 100_000);
    // gross = 400_000, fee per milestone = 100_000 * 1000 / 10000 = 10_000
    // total fee = 40_000, net = 360_000
    const project = simnet.callReadOnlyFn(CONTRACT, "get-project", [Cl.uint(1)], deployer);
    const pretty = Cl.prettyPrint(project.result);
    expect(pretty).toContain("total-amount: u360000");
    expect(pretty).toContain("fee-paid: u40000");
  });

  it("fails when sender == freelancer (ERR-NOT-CLIENT u100)", () => {
    const { result } = createStxProject(wallet1, wallet1, 100_000, 0, 0, 0);
    expect(result).toBeErr(Cl.uint(100));
  });

  it("fails with zero total amount (ERR-INVALID-AMOUNT u108)", () => {
    const { result } = createStxProject(wallet1, wallet2, 0, 0, 0, 0);
    expect(result).toBeErr(Cl.uint(108));
  });

  it("fails when contract is paused (ERR-CONTRACT-PAUSED u119)", () => {
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    const { result } = createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    expect(result).toBeErr(Cl.uint(119));
  });

  it("creates multiple projects with incrementing counter", () => {
    const r1 = createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    expect(r1.result).toBeOk(Cl.uint(1));
    const r2 = createStxProject(wallet1, wallet2, 200_000, 0, 0, 0);
    expect(r2.result).toBeOk(Cl.uint(2));
    const count = simnet.callReadOnlyFn(CONTRACT, "get-project-count", [], deployer);
    expect(count.result).toBeUint(2);
  });
});

// ════════════════════════════════════════════════════════════════════════
// 2. Milestone Completion
// ════════════════════════════════════════════════════════════════════════
describe("Milestone Completion", () => {
  it("freelancer completes milestone successfully", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    const { result } = completeMilestone(wallet2, 1, 1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("fails when not freelancer (ERR-NOT-FREELANCER u101)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    const { result } = completeMilestone(wallet1, 1, 1);
    expect(result).toBeErr(Cl.uint(101));
  });

  it("fails when already complete (ERR-ALREADY-COMPLETE u116)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    completeMilestone(wallet2, 1, 1);
    const { result } = completeMilestone(wallet2, 1, 1);
    expect(result).toBeErr(Cl.uint(116));
  });

  it("fails when project is refunded (ERR-ALREADY-REFUNDED u112)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    simnet.callPublicFn(CONTRACT, "request-full-refund-stx", [Cl.uint(1)], wallet1);
    const { result } = completeMilestone(wallet2, 1, 1);
    expect(result).toBeErr(Cl.uint(112));
  });

  it("fails when dispute is active on milestone (ERR-DISPUTE-ACTIVE u131)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    fileDispute(wallet1, 1, 1);
    const { result } = completeMilestone(wallet2, 1, 1);
    expect(result).toBeErr(Cl.uint(131));
  });
});

// ════════════════════════════════════════════════════════════════════════
// 3. Milestone Release (STX)
// ════════════════════════════════════════════════════════════════════════
describe("Milestone Release (STX)", () => {
  it("client releases completed milestone with correct amount", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    completeMilestone(wallet2, 1, 1);
    const { result } = releaseMilestoneStx(wallet1, 1, 1);
    // net amount = 100_000 - 10% fee = 90_000
    expect(result).toBeOk(Cl.uint(90_000));
  });

  it("fails when not client (ERR-NOT-CLIENT u100)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    completeMilestone(wallet2, 1, 1);
    const { result } = releaseMilestoneStx(wallet2, 1, 1);
    expect(result).toBeErr(Cl.uint(100));
  });

  it("fails when milestone not complete (ERR-NOT-COMPLETE u105)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    const { result } = releaseMilestoneStx(wallet1, 1, 1);
    expect(result).toBeErr(Cl.uint(105));
  });

  it("fails when already released (ERR-ALREADY-RELEASED u106)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    const { result } = releaseMilestoneStx(wallet1, 1, 1);
    expect(result).toBeErr(Cl.uint(106));
  });

  it("release auto-closes open dispute on milestone", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    completeMilestone(wallet2, 1, 1);
    fileDispute(wallet1, 1, 1);
    // Client releases anyway — should auto-close dispute
    releaseMilestoneStx(wallet1, 1, 1);
    const dispute = simnet.callReadOnlyFn(
      CONTRACT, "get-dispute", [Cl.uint(1), Cl.uint(1)], deployer
    );
    const pretty = Cl.prettyPrint(dispute.result);
    // DISPUTE-STATUS-RESOLVED = u2
    expect(pretty).toContain("status: u2");
  });
});

// ════════════════════════════════════════════════════════════════════════
// 4. Disputes
// ════════════════════════════════════════════════════════════════════════
describe("Disputes", () => {
  it("client files dispute successfully", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    const { result } = fileDispute(wallet1, 1, 1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("freelancer files dispute successfully", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    const { result } = fileDispute(wallet2, 1, 1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("fails when not a project party (ERR-NOT-PROJECT-PARTY u127)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    const { result } = fileDispute(wallet3, 1, 1);
    expect(result).toBeErr(Cl.uint(127));
  });

  it("fails when dispute already exists (ERR-DISPUTE-ALREADY-OPEN u126)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    fileDispute(wallet1, 1, 1);
    const { result } = fileDispute(wallet2, 1, 1);
    expect(result).toBeErr(Cl.uint(126));
  });

  it("fails when milestone already released (ERR-ALREADY-RELEASED u106)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    const { result } = fileDispute(wallet1, 1, 1);
    expect(result).toBeErr(Cl.uint(106));
  });

  it("fails when project is refunded (ERR-ALREADY-REFUNDED u112)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    simnet.callPublicFn(CONTRACT, "request-full-refund-stx", [Cl.uint(1)], wallet1);
    const { result } = fileDispute(wallet1, 1, 1);
    expect(result).toBeErr(Cl.uint(112));
  });

  it("get-dispute and get-dispute-count read-only verification", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    fileDispute(wallet1, 1, 1);
    fileDispute(wallet2, 1, 2);

    const d1 = simnet.callReadOnlyFn(CONTRACT, "get-dispute", [Cl.uint(1), Cl.uint(1)], deployer);
    const pretty = Cl.prettyPrint(d1.result);
    expect(pretty).toContain("status: u1"); // OPEN
    expect(pretty).toContain(wallet1); // filed-by

    const count = simnet.callReadOnlyFn(CONTRACT, "get-dispute-count", [], deployer);
    expect(count.result).toBeUint(2);
  });
});

// ════════════════════════════════════════════════════════════════════════
// 5. Admin Dispute Resolution (STX)
// ════════════════════════════════════════════════════════════════════════
describe("Admin Dispute Resolution (STX)", () => {
  it("resolves in favor of freelancer (funds to freelancer)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    fileDispute(wallet1, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT, "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(true)], deployer
    );
    expect(result).toBeOk(Cl.uint(90_000));
  });

  it("resolves in favor of client (funds to client)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    fileDispute(wallet1, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT, "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(false)], deployer
    );
    expect(result).toBeOk(Cl.uint(90_000));
  });

  it("fails when not owner (ERR-NOT-OWNER u113)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    fileDispute(wallet1, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT, "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(true)], wallet3
    );
    expect(result).toBeErr(Cl.uint(113));
  });

  it("fails when no open dispute (ERR-NO-OPEN-DISPUTE u128)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    const { result } = simnet.callPublicFn(
      CONTRACT, "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(true)], deployer
    );
    expect(result).toBeErr(Cl.uint(128));
  });

  it("dispute status updated correctly after resolution", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    fileDispute(wallet1, 1, 1);
    simnet.callPublicFn(
      CONTRACT, "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(true)], deployer
    );
    const dispute = simnet.callReadOnlyFn(
      CONTRACT, "get-dispute", [Cl.uint(1), Cl.uint(1)], deployer
    );
    const pretty = Cl.prettyPrint(dispute.result);
    expect(pretty).toContain("status: u2"); // RESOLVED
    expect(pretty).toContain(wallet2); // resolved-in-favor-of freelancer
  });
});

// ════════════════════════════════════════════════════════════════════════
// 6. Refunds (STX)
// ════════════════════════════════════════════════════════════════════════
describe("Refunds (STX)", () => {
  it("full refund succeeds (no milestone activity)", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    const { result } = simnet.callPublicFn(
      CONTRACT, "request-full-refund-stx", [Cl.uint(1)], wallet1
    );
    // net total = 180_000
    expect(result).toBeOk(Cl.uint(180_000));
  });

  it("full refund fails with activity (ERR-REFUND-NOT-ALLOWED u111)", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    completeMilestone(wallet2, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT, "request-full-refund-stx", [Cl.uint(1)], wallet1
    );
    expect(result).toBeErr(Cl.uint(111));
  });

  it("full refund fails with open dispute (ERR-DISPUTE-ACTIVE u131)", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    fileDispute(wallet1, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT, "request-full-refund-stx", [Cl.uint(1)], wallet1
    );
    expect(result).toBeErr(Cl.uint(131));
  });

  it("emergency refund succeeds after timeout (144 burn blocks)", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    completeMilestone(wallet2, 1, 1);
    // Advance past REFUND-TIMEOUT (144 blocks)
    simnet.mineEmptyBlocks(144);
    const { result } = simnet.callPublicFn(
      CONTRACT, "emergency-refund-stx", [Cl.uint(1)], wallet1
    );
    // Net total = 180_000, milestone 1 not released, so refund = 180_000
    expect(result).toBeOk(Cl.uint(180_000));
  });

  it("emergency refund fails too early (ERR-REFUND-NOT-ALLOWED u111)", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    completeMilestone(wallet2, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT, "emergency-refund-stx", [Cl.uint(1)], wallet1
    );
    expect(result).toBeErr(Cl.uint(111));
  });

  it("emergency refund fails with open dispute (ERR-DISPUTE-ACTIVE u131)", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    fileDispute(wallet1, 1, 1);
    simnet.mineEmptyBlocks(144);
    const { result } = simnet.callPublicFn(
      CONTRACT, "emergency-refund-stx", [Cl.uint(1)], wallet1
    );
    expect(result).toBeErr(Cl.uint(131));
  });

  it("emergency refund partial: only unreleased milestones refunded", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    // Advance past timeout
    simnet.mineEmptyBlocks(144);
    const { result } = simnet.callPublicFn(
      CONTRACT, "emergency-refund-stx", [Cl.uint(1)], wallet1
    );
    // Net total = 180_000, released milestone 1 = 90_000, refund = 90_000
    expect(result).toBeOk(Cl.uint(90_000));
  });
});

// ════════════════════════════════════════════════════════════════════════
// 7. Admin Force Actions (STX)
// ════════════════════════════════════════════════════════════════════════
describe("Admin Force Actions (STX)", () => {
  it("force release succeeds after timeout, auto-closes dispute", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    completeMilestone(wallet2, 1, 1);
    fileDispute(wallet1, 1, 1);
    // Advance past FORCE-RELEASE-TIMEOUT (144 blocks)
    simnet.mineEmptyBlocks(144);
    const { result } = simnet.callPublicFn(
      CONTRACT, "admin-force-release-stx", [Cl.uint(1), Cl.uint(1)], deployer
    );
    expect(result).toBeOk(Cl.uint(90_000));
    // Verify dispute auto-closed
    const dispute = simnet.callReadOnlyFn(
      CONTRACT, "get-dispute", [Cl.uint(1), Cl.uint(1)], deployer
    );
    const pretty = Cl.prettyPrint(dispute.result);
    expect(pretty).toContain("status: u2"); // RESOLVED
  });

  it("force release fails too early (ERR-FORCE-RELEASE-TOO-EARLY u125)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    completeMilestone(wallet2, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT, "admin-force-release-stx", [Cl.uint(1), Cl.uint(1)], deployer
    );
    expect(result).toBeErr(Cl.uint(125));
  });

  it("force release fails when not complete (ERR-NOT-COMPLETE u105)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    simnet.mineEmptyBlocks(144);
    const { result } = simnet.callPublicFn(
      CONTRACT, "admin-force-release-stx", [Cl.uint(1), Cl.uint(1)], deployer
    );
    expect(result).toBeErr(Cl.uint(105));
  });

  it("force refund succeeds after abandon timeout (1008 blocks)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    simnet.mineEmptyBlocks(1008);
    const { result } = simnet.callPublicFn(
      CONTRACT, "admin-force-refund-stx", [Cl.uint(1)], deployer
    );
    expect(result).toBeOk(Cl.uint(90_000));
  });

  it("force refund fails too early (ERR-PROJECT-NOT-ABANDONED u122)", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    const { result } = simnet.callPublicFn(
      CONTRACT, "admin-force-refund-stx", [Cl.uint(1)], deployer
    );
    expect(result).toBeErr(Cl.uint(122));
  });

  it("force refund closes all project disputes", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    fileDispute(wallet1, 1, 1);
    fileDispute(wallet2, 1, 2);
    simnet.mineEmptyBlocks(1008);
    simnet.callPublicFn(CONTRACT, "admin-force-refund-stx", [Cl.uint(1)], deployer);
    // Both disputes should be resolved
    const d1 = simnet.callReadOnlyFn(CONTRACT, "get-dispute", [Cl.uint(1), Cl.uint(1)], deployer);
    expect(Cl.prettyPrint(d1.result)).toContain("status: u2");
    const d2 = simnet.callReadOnlyFn(CONTRACT, "get-dispute", [Cl.uint(1), Cl.uint(2)], deployer);
    expect(Cl.prettyPrint(d2.result)).toContain("status: u2");
  });

  it("admin reset milestone clears dispute", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    completeMilestone(wallet2, 1, 1);
    fileDispute(wallet1, 1, 1);
    simnet.callPublicFn(
      CONTRACT, "admin-reset-milestone", [Cl.uint(1), Cl.uint(1)], deployer
    );
    // Dispute should be deleted (map-delete)
    const dispute = simnet.callReadOnlyFn(
      CONTRACT, "get-dispute", [Cl.uint(1), Cl.uint(1)], deployer
    );
    expect(dispute.result).toBeNone();
    // Milestone should be reset
    const ms = simnet.callReadOnlyFn(
      CONTRACT, "get-milestone", [Cl.uint(1), Cl.uint(1)], deployer
    );
    expect(ms.result).toBeSome(
      Cl.tuple({
        amount: Cl.uint(90_000),
        complete: Cl.bool(false),
        released: Cl.bool(false),
        "completed-at": Cl.uint(0),
      })
    );
  });
});

// ════════════════════════════════════════════════════════════════════════
// 8. Admin Configuration
// ════════════════════════════════════════════════════════════════════════
describe("Admin Configuration", () => {
  it("set-treasury: success", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT, "set-treasury", [Cl.principal(wallet3)], deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it("set-treasury: no-change guard (ERR-NO-CHANGE u129)", () => {
    // Treasury defaults to deployer
    const { result } = simnet.callPublicFn(
      CONTRACT, "set-treasury", [Cl.principal(deployer)], deployer
    );
    expect(result).toBeErr(Cl.uint(129));
  });

  it("propose-ownership + accept-ownership: full flow", () => {
    const r1 = simnet.callPublicFn(
      CONTRACT, "propose-ownership", [Cl.principal(wallet1)], deployer
    );
    expect(r1.result).toBeOk(Cl.bool(true));
    const r2 = simnet.callPublicFn(CONTRACT, "accept-ownership", [], wallet1);
    expect(r2.result).toBeOk(Cl.bool(true));
    // Verify new owner
    const owner = simnet.callReadOnlyFn(CONTRACT, "get-contract-owner", [], deployer);
    expect(owner.result).toBePrincipal(wallet1);
  });

  it("accept-ownership fails: wrong sender (ERR-NOT-OWNER u113)", () => {
    simnet.callPublicFn(CONTRACT, "propose-ownership", [Cl.principal(wallet1)], deployer);
    const { result } = simnet.callPublicFn(CONTRACT, "accept-ownership", [], wallet3);
    expect(result).toBeErr(Cl.uint(113));
  });

  it("set-paused: success", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT, "set-paused", [Cl.bool(true)], deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it("set-paused: no-change guard (ERR-NO-CHANGE u129)", () => {
    // Contract starts unpaused, so setting to false is a no-change
    const { result } = simnet.callPublicFn(
      CONTRACT, "set-paused", [Cl.bool(false)], deployer
    );
    expect(result).toBeErr(Cl.uint(129));
  });

  it("set-fee-rate: success", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT, "set-fee-rate", [Cl.uint(500)], deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it("set-fee-rate: no-change guard (ERR-NO-CHANGE u129)", () => {
    // Default fee is 1000
    const { result } = simnet.callPublicFn(
      CONTRACT, "set-fee-rate", [Cl.uint(1000)], deployer
    );
    expect(result).toBeErr(Cl.uint(129));
  });

  it("set-fee-rate: cap guard (ERR-FEE-TOO-HIGH u120)", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT, "set-fee-rate", [Cl.uint(1001)], deployer
    );
    expect(result).toBeErr(Cl.uint(120));
  });

  it("all config functions fail for non-owner (ERR-NOT-OWNER u113)", () => {
    const r1 = simnet.callPublicFn(
      CONTRACT, "set-treasury", [Cl.principal(wallet3)], wallet1
    );
    expect(r1.result).toBeErr(Cl.uint(113));

    const r2 = simnet.callPublicFn(
      CONTRACT, "set-paused", [Cl.bool(true)], wallet1
    );
    expect(r2.result).toBeErr(Cl.uint(113));

    const r3 = simnet.callPublicFn(
      CONTRACT, "set-fee-rate", [Cl.uint(500)], wallet1
    );
    expect(r3.result).toBeErr(Cl.uint(113));

    const r4 = simnet.callPublicFn(
      CONTRACT, "propose-ownership", [Cl.principal(wallet3)], wallet1
    );
    expect(r4.result).toBeErr(Cl.uint(113));
  });
});

// ════════════════════════════════════════════════════════════════════════
// 9. Read-Only Functions
// ════════════════════════════════════════════════════════════════════════
describe("Read-Only Functions", () => {
  it("get-project returns correct data", () => {
    createStxProject(wallet1, wallet2, 100_000, 50_000, 0, 0);
    const { result } = simnet.callReadOnlyFn(CONTRACT, "get-project", [Cl.uint(1)], deployer);
    const pretty = Cl.prettyPrint(result);
    expect(pretty).toContain(wallet1); // client
    expect(pretty).toContain(wallet2); // freelancer
    expect(pretty).toContain("num-milestones: u2");
    expect(pretty).toContain("refunded: false");
    expect(pretty).toContain("token-type: u0"); // TOKEN-STX
  });

  it("get-milestone returns correct data", () => {
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    const { result } = simnet.callReadOnlyFn(
      CONTRACT, "get-milestone", [Cl.uint(1), Cl.uint(1)], deployer
    );
    // Net amount = 100_000 - 10% = 90_000
    expect(result).toBeSome(
      Cl.tuple({
        amount: Cl.uint(90_000),
        complete: Cl.bool(false),
        released: Cl.bool(false),
        "completed-at": Cl.uint(0),
      })
    );
  });

  it("get-project-status-summary returns correct computed fields", () => {
    createStxProject(wallet1, wallet2, 100_000, 100_000, 0, 0);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    const { result } = simnet.callReadOnlyFn(
      CONTRACT, "get-project-status-summary", [Cl.uint(1)], deployer
    );
    const pretty = Cl.prettyPrint(result);
    expect(pretty).toContain("milestones-complete: u1");
    expect(pretty).toContain("milestones-released: u1");
    expect(pretty).toContain("total-amount: u180000");
    expect(pretty).toContain("fee-paid: u20000");
    expect(pretty).toContain("released-amount: u90000");
    expect(pretty).toContain("refundable-amount: u90000");
    expect(pretty).toContain("refunded: false");
    expect(pretty).toContain("token-type: u0");
  });

  it("get-project-count tracks correctly", () => {
    const c0 = simnet.callReadOnlyFn(CONTRACT, "get-project-count", [], deployer);
    expect(c0.result).toBeUint(0);
    createStxProject(wallet1, wallet2, 100_000, 0, 0, 0);
    const c1 = simnet.callReadOnlyFn(CONTRACT, "get-project-count", [], deployer);
    expect(c1.result).toBeUint(1);
    createStxProject(wallet1, wallet2, 200_000, 0, 0, 0);
    const c2 = simnet.callReadOnlyFn(CONTRACT, "get-project-count", [], deployer);
    expect(c2.result).toBeUint(2);
  });
});
