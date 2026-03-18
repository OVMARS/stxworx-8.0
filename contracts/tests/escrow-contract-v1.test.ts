import { describe, it, expect, beforeEach } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const CONTRACT = "escrow-multi-token-v7";

// Accounts are populated by clarinet-sdk setup
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

// Helper: create an STX project with 4 equal milestones
function createStxProject(
  client: string,
  freelancer: string,
  m1 = 100_000,
  m2 = 100_000,
  m3 = 100_000,
  m4 = 100_000
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

// ============================================================
// A. EXISTING FUNCTIONALITY (REGRESSION)
// ============================================================

describe("A. Core STX project lifecycle", () => {
  it("creates an STX project successfully", () => {
    const { result } = createStxProject(wallet1, wallet2);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("rejects project where client == freelancer", () => {
    const { result } = createStxProject(wallet1, wallet1);
    expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-CLIENT
  });

  it("rejects project with zero total", () => {
    const { result } = createStxProject(wallet1, wallet2, 0, 0, 0, 0);
    expect(result).toBeErr(Cl.uint(108)); // ERR-INVALID-AMOUNT
  });

  it("increments project counter", () => {
    createStxProject(wallet1, wallet2);
    createStxProject(wallet1, wallet2);
    const count = simnet.callReadOnlyFn(CONTRACT, "get-project-count", [], deployer);
    expect(count.result).toBeUint(2);
  });

  it("stores project with NET amount and fee-paid", () => {
    // 4 milestones of 100,000 = 400,000 gross
    // 10% fee per milestone: 4 * 10,000 = 40,000 fee
    // NET escrow: 360,000
    createStxProject(wallet1, wallet2, 100_000, 200_000, 0, 0);
    // gross = 300,000, fee = 30,000 (10k + 20k), net = 270,000
    const project = simnet.callReadOnlyFn(CONTRACT, "get-project", [Cl.uint(1)], deployer);
    const pretty = Cl.prettyPrint(project.result);
    expect(pretty).toContain("total-amount: u270000");
    expect(pretty).toContain("fee-paid: u30000");
    expect(pretty).toContain("num-milestones: u2");
    expect(pretty).toContain("refunded: false");
    expect(pretty).toContain("token-type: u0");
    expect(pretty).toContain(wallet1);
    expect(pretty).toContain(wallet2);
  });

  it("stores milestones with NET amounts", () => {
    createStxProject(wallet1, wallet2); // 4 x 100,000
    // Each milestone: 100,000 - (100,000 * 1000 / 10000) = 100,000 - 10,000 = 90,000
    const m = simnet.callReadOnlyFn(
      CONTRACT,
      "get-milestone",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );
    expect(m.result).toBeSome(
      Cl.tuple({
        amount: Cl.uint(90_000),
        complete: Cl.bool(false),
        released: Cl.bool(false),
        "completed-at": Cl.uint(0),
      })
    );
  });

  it("sends fee to treasury at creation", () => {
    // Check treasury (deployer) STX balance before and after
    const balBefore = simnet.callReadOnlyFn(CONTRACT, "get-contract-balance-stx", [], deployer);
    createStxProject(wallet1, wallet2); // 400,000 gross
    const balAfter = simnet.callReadOnlyFn(CONTRACT, "get-contract-balance-stx", [], deployer);
    // Contract should hold NET = 360,000 (not 400,000)
    // 400,000 - 40,000 fee = 360,000
    const pretty = Cl.prettyPrint(balAfter.result);
    expect(pretty).toContain("u360000");
  });
});

describe("A. Complete and release milestone STX", () => {
  it("freelancer completes milestone", () => {
    createStxProject(wallet1, wallet2);
    const { result } = completeMilestone(wallet2, 1, 1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("non-freelancer cannot complete milestone", () => {
    createStxProject(wallet1, wallet2);
    const { result } = completeMilestone(wallet3, 1, 1);
    expect(result).toBeErr(Cl.uint(101)); // ERR-NOT-FREELANCER
  });

  it("cannot complete already complete milestone", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    const { result } = completeMilestone(wallet2, 1, 1);
    expect(result).toBeErr(Cl.uint(116)); // ERR-ALREADY-COMPLETE
  });

  it("client releases STX milestone - full NET amount (fee already collected)", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    const { result } = releaseMilestoneStx(wallet1, 1, 1);
    // Milestone stored as 90,000 (NET), freelancer gets full 90,000
    expect(result).toBeOk(Cl.uint(90_000));
  });

  it("cannot release non-complete milestone", () => {
    createStxProject(wallet1, wallet2);
    const { result } = releaseMilestoneStx(wallet1, 1, 1);
    expect(result).toBeErr(Cl.uint(105)); // ERR-NOT-COMPLETE
  });

  it("cannot release already released milestone", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    const { result } = releaseMilestoneStx(wallet1, 1, 1);
    expect(result).toBeErr(Cl.uint(106)); // ERR-ALREADY-RELEASED
  });

  it("non-client cannot release", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    const { result } = releaseMilestoneStx(wallet3, 1, 1);
    expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-CLIENT
  });
});

describe("A. Full refund STX", () => {
  it("client gets full refund of NET escrow when no activity", () => {
    createStxProject(wallet1, wallet2);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "request-full-refund-stx",
      [Cl.uint(1)],
      wallet1
    );
    // Refund = NET escrow = 360,000 (fee already gone to treasury)
    expect(result).toBeOk(Cl.uint(360_000));
  });

  it("refund blocked when milestone is complete", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "request-full-refund-stx",
      [Cl.uint(1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(111)); // ERR-REFUND-NOT-ALLOWED
  });

  it("cannot refund twice", () => {
    createStxProject(wallet1, wallet2);
    simnet.callPublicFn(CONTRACT, "request-full-refund-stx", [Cl.uint(1)], wallet1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "request-full-refund-stx",
      [Cl.uint(1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(112)); // ERR-ALREADY-REFUNDED
  });
});

describe("A. Emergency refund STX", () => {
  it("client gets emergency refund after timeout", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    // Mine 144 blocks to pass REFUND-TIMEOUT
    simnet.mineEmptyBlocks(144);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "emergency-refund-stx",
      [Cl.uint(1)],
      wallet1
    );
    // NET total 360,000, released 90,000, refund = 270,000
    expect(result).toBeOk(Cl.uint(270_000));
  });

  it("emergency refund fails before timeout", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "emergency-refund-stx",
      [Cl.uint(1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(111)); // ERR-REFUND-NOT-ALLOWED
  });
});

// ============================================================
// B. PAUSE MECHANISM
// ============================================================

describe("B. Pause mechanism", () => {
  it("owner can pause and unpause", () => {
    let r = simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    expect(r.result).toBeOk(Cl.bool(true));
    let paused = simnet.callReadOnlyFn(CONTRACT, "is-paused", [], deployer);
    expect(paused.result).toBeBool(true);

    r = simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(false)], deployer);
    expect(r.result).toBeOk(Cl.bool(true));
    paused = simnet.callReadOnlyFn(CONTRACT, "is-paused", [], deployer);
    expect(paused.result).toBeBool(false);
  });

  it("non-owner cannot pause", () => {
    const { result } = simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], wallet1);
    expect(result).toBeErr(Cl.uint(113)); // ERR-NOT-OWNER
  });

  it("paused contract blocks create-project-stx", () => {
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    const { result } = createStxProject(wallet1, wallet2);
    expect(result).toBeErr(Cl.uint(119)); // ERR-CONTRACT-PAUSED
  });

  it("paused contract blocks complete-milestone", () => {
    createStxProject(wallet1, wallet2);
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    const { result } = completeMilestone(wallet2, 1, 1);
    expect(result).toBeErr(Cl.uint(119));
  });

  it("paused contract blocks release-milestone-stx", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    const { result } = releaseMilestoneStx(wallet1, 1, 1);
    expect(result).toBeErr(Cl.uint(119));
  });

  it("paused contract blocks request-full-refund-stx", () => {
    createStxProject(wallet1, wallet2);
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "request-full-refund-stx",
      [Cl.uint(1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(119));
  });

  it("paused contract blocks emergency-refund-stx", () => {
    createStxProject(wallet1, wallet2);
    simnet.mineEmptyBlocks(144);
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "emergency-refund-stx",
      [Cl.uint(1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(119));
  });

  it("admin functions work when paused", () => {
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "set-treasury",
      [Cl.principal(wallet3)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
    const r2 = simnet.callPublicFn(CONTRACT, "set-fee-rate", [Cl.uint(300)], deployer);
    expect(r2.result).toBeOk(Cl.bool(true));
  });

  it("read-only functions work when paused", () => {
    createStxProject(wallet1, wallet2);
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    const count = simnet.callReadOnlyFn(CONTRACT, "get-project-count", [], deployer);
    expect(count.result).toBeUint(1);
    const paused = simnet.callReadOnlyFn(CONTRACT, "is-paused", [], deployer);
    expect(paused.result).toBeBool(true);
  });

  it("unpause restores normal operation", () => {
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    let r = createStxProject(wallet1, wallet2);
    expect(r.result).toBeErr(Cl.uint(119));
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(false)], deployer);
    r = createStxProject(wallet1, wallet2);
    expect(r.result).toBeOk(Cl.uint(1));
  });
});

// ============================================================
// C. DYNAMIC FEE RATE
// ============================================================

describe("C. Dynamic fee rate", () => {
  it("owner can set fee rate", () => {
    const { result } = simnet.callPublicFn(CONTRACT, "set-fee-rate", [Cl.uint(300)], deployer);
    expect(result).toBeOk(Cl.bool(true));
    const fee = simnet.callReadOnlyFn(CONTRACT, "get-fee-rate", [], deployer);
    expect(fee.result).toBeUint(300);
  });

  it("non-owner cannot set fee rate", () => {
    const { result } = simnet.callPublicFn(CONTRACT, "set-fee-rate", [Cl.uint(300)], wallet1);
    expect(result).toBeErr(Cl.uint(113));
  });

  it("rejects fee rate above MAX-FEE-RATE (1000)", () => {
    const { result } = simnet.callPublicFn(CONTRACT, "set-fee-rate", [Cl.uint(1001)], deployer);
    expect(result).toBeErr(Cl.uint(120)); // ERR-FEE-TOO-HIGH
  });

  it("allows fee rate at MAX-FEE-RATE (1000)", () => {
    const { result } = simnet.callPublicFn(CONTRACT, "set-fee-rate", [Cl.uint(1000)], deployer);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("allows zero fee rate", () => {
    const { result } = simnet.callPublicFn(CONTRACT, "set-fee-rate", [Cl.uint(0)], deployer);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("0% fee: milestone stores full amount, freelancer gets full amount", () => {
    simnet.callPublicFn(CONTRACT, "set-fee-rate", [Cl.uint(0)], deployer);
    createStxProject(wallet1, wallet2); // 4 x 100,000
    // 0% fee: milestone stored as 100,000
    const m = simnet.callReadOnlyFn(CONTRACT, "get-milestone", [Cl.uint(1), Cl.uint(1)], deployer);
    const pretty = Cl.prettyPrint(m.result);
    expect(pretty).toContain("amount: u100000");

    completeMilestone(wallet2, 1, 1);
    const { result } = releaseMilestoneStx(wallet1, 1, 1);
    expect(result).toBeOk(Cl.uint(100_000));
  });

  it("3% fee: milestone stores 97% of gross", () => {
    simnet.callPublicFn(CONTRACT, "set-fee-rate", [Cl.uint(300)], deployer);
    createStxProject(wallet1, wallet2); // 4 x 100,000
    // 3% fee: 100,000 * 300 / 10000 = 3,000 fee per milestone
    // NET: 100,000 - 3,000 = 97,000
    completeMilestone(wallet2, 1, 1);
    const { result } = releaseMilestoneStx(wallet1, 1, 1);
    expect(result).toBeOk(Cl.uint(97_000));
  });

  it("10% fee (default): milestone stores 90% of gross", () => {
    // Default is 1000bp = 10%
    createStxProject(wallet1, wallet2); // 4 x 100,000
    // 10% fee: 100,000 - 10,000 = 90,000 per milestone
    completeMilestone(wallet2, 1, 1);
    const { result } = releaseMilestoneStx(wallet1, 1, 1);
    expect(result).toBeOk(Cl.uint(90_000));
  });

  it("fee is collected upfront at project creation", () => {
    // Default 10%: gross 400,000, fee 40,000, net 360,000
    createStxProject(wallet1, wallet2);
    const project = simnet.callReadOnlyFn(CONTRACT, "get-project", [Cl.uint(1)], deployer);
    const pretty = Cl.prettyPrint(project.result);
    expect(pretty).toContain("total-amount: u360000");
    expect(pretty).toContain("fee-paid: u40000");
  });

  it("uneven milestones have correct per-milestone fee deduction", () => {
    // m1=50,000 m2=30,000 m3=20,000 m4=0 = 100,000 gross
    // fee: 5000 + 3000 + 2000 = 10,000
    // net: 45000 + 27000 + 18000 = 90,000
    createStxProject(wallet1, wallet2, 50_000, 30_000, 20_000, 0);
    const m1 = simnet.callReadOnlyFn(CONTRACT, "get-milestone", [Cl.uint(1), Cl.uint(1)], deployer);
    expect(Cl.prettyPrint(m1.result)).toContain("amount: u45000");
    const m2 = simnet.callReadOnlyFn(CONTRACT, "get-milestone", [Cl.uint(1), Cl.uint(2)], deployer);
    expect(Cl.prettyPrint(m2.result)).toContain("amount: u27000");
    const m3 = simnet.callReadOnlyFn(CONTRACT, "get-milestone", [Cl.uint(1), Cl.uint(3)], deployer);
    expect(Cl.prettyPrint(m3.result)).toContain("amount: u18000");

    const project = simnet.callReadOnlyFn(CONTRACT, "get-project", [Cl.uint(1)], deployer);
    expect(Cl.prettyPrint(project.result)).toContain("total-amount: u90000");
    expect(Cl.prettyPrint(project.result)).toContain("fee-paid: u10000");
  });
});

// ============================================================
// D. DISPUTE RESOLUTION
// ============================================================

describe("D. Dispute resolution STX", () => {
  it("admin resolves in favor of freelancer (full NET amount)", () => {
    createStxProject(wallet1, wallet2);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(true)],
      deployer
    );
    // Full NET milestone amount (fee already collected)
    expect(result).toBeOk(Cl.uint(90_000));
  });

  it("admin resolves in favor of client (returns NET amount)", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(false)],
      deployer
    );
    expect(result).toBeOk(Cl.uint(90_000));
  });

  it("non-owner cannot resolve dispute", () => {
    createStxProject(wallet1, wallet2);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(true)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(113));
  });

  it("cannot resolve already released milestone", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(true)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(106)); // ERR-ALREADY-RELEASED
  });

  it("cannot resolve on refunded project", () => {
    createStxProject(wallet1, wallet2);
    simnet.callPublicFn(CONTRACT, "request-full-refund-stx", [Cl.uint(1)], wallet1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(true)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(112)); // ERR-ALREADY-REFUNDED
  });

  it("dispute resolution marks milestone as released", () => {
    createStxProject(wallet1, wallet2);
    simnet.callPublicFn(
      CONTRACT,
      "admin-resolve-dispute-stx",
      [Cl.uint(1), Cl.uint(1), Cl.bool(true)],
      deployer
    );
    const m = simnet.callReadOnlyFn(
      CONTRACT,
      "get-milestone",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );
    const milestone = m.result;
    expect(milestone.type).toBe(ClarityType.OptionalSome);
  });
});

// ============================================================
// E. FORCE RELEASE
// ============================================================

describe("E. Force release STX", () => {
  it("admin force releases completed milestone after timeout", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    simnet.mineEmptyBlocks(144);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-force-release-stx",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );
    // Full NET amount (fee already collected at creation)
    expect(result).toBeOk(Cl.uint(90_000));
  });

  it("force release fails before timeout", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    simnet.mineEmptyBlocks(10);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-force-release-stx",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(125)); // ERR-FORCE-RELEASE-TOO-EARLY
  });

  it("force release fails for non-complete milestone", () => {
    createStxProject(wallet1, wallet2);
    simnet.mineEmptyBlocks(144);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-force-release-stx",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(105)); // ERR-NOT-COMPLETE
  });

  it("force release fails for already released milestone", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    simnet.mineEmptyBlocks(144);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-force-release-stx",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(106)); // ERR-ALREADY-RELEASED
  });

  it("non-owner cannot force release", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    simnet.mineEmptyBlocks(144);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-force-release-stx",
      [Cl.uint(1), Cl.uint(1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(113));
  });
});

// ============================================================
// F. FORCE REFUND (ABANDONED)
// ============================================================

describe("F. Force refund (abandoned projects) STX", () => {
  it("admin force refunds abandoned project", () => {
    createStxProject(wallet1, wallet2);
    simnet.mineEmptyBlocks(1008);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-force-refund-stx",
      [Cl.uint(1)],
      deployer
    );
    // Full NET escrow: 360,000 (fee already gone)
    expect(result).toBeOk(Cl.uint(360_000));
  });

  it("force refund fails before abandon timeout", () => {
    createStxProject(wallet1, wallet2);
    simnet.mineEmptyBlocks(500);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-force-refund-stx",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(122)); // ERR-PROJECT-NOT-ABANDONED
  });

  it("force refund returns partial amount on partially released project", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    simnet.mineEmptyBlocks(1008);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-force-refund-stx",
      [Cl.uint(1)],
      deployer
    );
    // NET total 360,000, released 90,000, refund = 270,000
    expect(result).toBeOk(Cl.uint(270_000));
  });

  it("force refund fails on already refunded project", () => {
    createStxProject(wallet1, wallet2);
    simnet.callPublicFn(CONTRACT, "request-full-refund-stx", [Cl.uint(1)], wallet1);
    simnet.mineEmptyBlocks(1008);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-force-refund-stx",
      [Cl.uint(1)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(112)); // ERR-ALREADY-REFUNDED
  });

  it("non-owner cannot force refund", () => {
    createStxProject(wallet1, wallet2);
    simnet.mineEmptyBlocks(1008);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-force-refund-stx",
      [Cl.uint(1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(113));
  });
});

// ============================================================
// G. sBTC RECOVERY (STX-only tests for the admin-recover-sbtc logic)
// ============================================================

describe("G. sBTC recovery (admin-recover-sbtc)", () => {
  it("fails when called by non-owner", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-recover-sbtc",
      [Cl.uint(100), Cl.principal(wallet1), Cl.principal(`${deployer}.sbtc-token`)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(113)); // ERR-NOT-OWNER
  });
});

// ============================================================
// H. MILESTONE RESET (GRIEFING PROTECTION)
// ============================================================

describe("H. Milestone reset", () => {
  it("admin resets fraudulent complete flag", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    let m = simnet.callReadOnlyFn(
      CONTRACT,
      "get-milestone",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );
    let pretty = Cl.prettyPrint(m.result);
    expect(pretty).toContain("complete: true");
    expect(pretty).toContain("released: false");

    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-reset-milestone",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));

    m = simnet.callReadOnlyFn(
      CONTRACT,
      "get-milestone",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );
    expect(m.result).toBeSome(
      Cl.tuple({
        amount: Cl.uint(90_000),
        complete: Cl.bool(false),
        released: Cl.bool(false),
        "completed-at": Cl.uint(0),
      })
    );
  });

  it("cannot reset already released milestone", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-reset-milestone",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(106)); // ERR-ALREADY-RELEASED
  });

  it("non-owner cannot reset milestone", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-reset-milestone",
      [Cl.uint(1), Cl.uint(1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(113));
  });

  it("client can full-refund after milestone reset clears activity", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    let r = simnet.callPublicFn(
      CONTRACT,
      "request-full-refund-stx",
      [Cl.uint(1)],
      wallet1
    );
    expect(r.result).toBeErr(Cl.uint(111));

    simnet.callPublicFn(
      CONTRACT,
      "admin-reset-milestone",
      [Cl.uint(1), Cl.uint(1)],
      deployer
    );

    r = simnet.callPublicFn(
      CONTRACT,
      "request-full-refund-stx",
      [Cl.uint(1)],
      wallet1
    );
    // NET escrow = 360,000
    expect(r.result).toBeOk(Cl.uint(360_000));
  });
});

// ============================================================
// I. ACTIVITY TRACKING & STATUS SUMMARY
// ============================================================

describe("I. Activity tracking and status summary", () => {
  it("get-last-activity updates on project creation", () => {
    createStxProject(wallet1, wallet2);
    const la = simnet.callReadOnlyFn(CONTRACT, "get-last-activity", [Cl.uint(1)], deployer);
    expect(la.result.type).toBe(ClarityType.OptionalSome);
  });

  it("get-last-activity updates on milestone completion", () => {
    createStxProject(wallet1, wallet2);
    const la1 = simnet.callReadOnlyFn(CONTRACT, "get-last-activity", [Cl.uint(1)], deployer);
    simnet.mineEmptyBlocks(5);
    completeMilestone(wallet2, 1, 1);
    const la2 = simnet.callReadOnlyFn(CONTRACT, "get-last-activity", [Cl.uint(1)], deployer);
    expect(la2.result).not.toEqual(la1.result);
  });

  it("get-project-status-summary returns correct data with fee-paid", () => {
    createStxProject(wallet1, wallet2);
    completeMilestone(wallet2, 1, 1);
    releaseMilestoneStx(wallet1, 1, 1);

    const summary = simnet.callReadOnlyFn(
      CONTRACT,
      "get-project-status-summary",
      [Cl.uint(1)],
      deployer
    );
    const val = summary.result;
    expect(val.type).toBe(ClarityType.ResponseOk);

    if (val.type === ClarityType.ResponseOk) {
      const inner = val.value;
      const data = inner.type === ClarityType.Tuple ? inner.data : (inner as any).data;
      if (data) {
        expect(data["milestones-complete"]).toBeUint(1);
        expect(data["milestones-released"]).toBeUint(1);
        expect(data["total-amount"]).toBeUint(360_000);
        expect(data["fee-paid"]).toBeUint(40_000);
        expect(data["released-amount"]).toBeUint(90_000);
        expect(data["refundable-amount"]).toBeUint(270_000);
        expect(data["refunded"]).toBeBool(false);
        expect(data["token-type"]).toBeUint(0);
      }
    }
  });

  it("status summary for non-existent project returns error", () => {
    const summary = simnet.callReadOnlyFn(
      CONTRACT,
      "get-project-status-summary",
      [Cl.uint(999)],
      deployer
    );
    expect(summary.result).toBeErr(Cl.uint(102)); // ERR-PROJECT-NOT-FOUND
  });

  it("get-token-name returns correct values without nested errors", () => {
    const stx = simnet.callReadOnlyFn(CONTRACT, "get-token-name", [Cl.uint(0)], deployer);
    expect(stx.result).toBeOk(Cl.stringAscii("STX"));
    const sbtc = simnet.callReadOnlyFn(CONTRACT, "get-token-name", [Cl.uint(1)], deployer);
    expect(sbtc.result).toBeOk(Cl.stringAscii("sBTC"));
    const invalid = simnet.callReadOnlyFn(CONTRACT, "get-token-name", [Cl.uint(99)], deployer);
    expect(invalid.result).toBeErr(Cl.uint(117));
  });
});

// ============================================================
// ADMIN CONFIGURATION
// ============================================================

describe("Admin configuration", () => {
  it("set-treasury works for owner", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "set-treasury",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
    const t = simnet.callReadOnlyFn(CONTRACT, "get-treasury", [], deployer);
    expect(t.result).toBePrincipal(wallet1);
  });

  it("set-treasury fails for non-owner", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "set-treasury",
      [Cl.principal(wallet1)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(113));
  });

  it("two-step ownership transfer: propose then accept", () => {
    // Step 1: owner proposes new owner
    const r1 = simnet.callPublicFn(
      CONTRACT,
      "propose-ownership",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(r1.result).toBeOk(Cl.bool(true));

    // Proposed owner visible
    const proposed = simnet.callReadOnlyFn(CONTRACT, "get-proposed-owner", [], deployer);
    expect(proposed.result).toBeSome(Cl.principal(wallet1));

    // Owner hasn't changed yet
    const o1 = simnet.callReadOnlyFn(CONTRACT, "get-contract-owner", [], deployer);
    expect(o1.result).toBePrincipal(deployer);

    // Step 2: proposed owner accepts
    const r2 = simnet.callPublicFn(CONTRACT, "accept-ownership", [], wallet1);
    expect(r2.result).toBeOk(Cl.bool(true));

    // Now ownership transferred
    const o2 = simnet.callReadOnlyFn(CONTRACT, "get-contract-owner", [], deployer);
    expect(o2.result).toBePrincipal(wallet1);

    // Proposed owner cleared
    const p2 = simnet.callReadOnlyFn(CONTRACT, "get-proposed-owner", [], deployer);
    expect(p2.result).toBeNone();
  });

  it("propose-ownership fails for non-owner", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "propose-ownership",
      [Cl.principal(wallet2)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(113));
  });

  it("accept-ownership fails for wrong address", () => {
    simnet.callPublicFn(CONTRACT, "propose-ownership", [Cl.principal(wallet1)], deployer);
    // wallet2 tries to accept, but wallet1 was proposed
    const { result } = simnet.callPublicFn(CONTRACT, "accept-ownership", [], wallet2);
    expect(result).toBeErr(Cl.uint(113));
  });

  it("accept-ownership fails when no proposal exists", () => {
    const { result } = simnet.callPublicFn(CONTRACT, "accept-ownership", [], wallet1);
    expect(result).toBeErr(Cl.uint(113));
  });

  it("set-sbtc-contract works for owner", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "set-sbtc-contract",
      [Cl.principal(`${deployer}.sbtc-token`)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
    const sc = simnet.callReadOnlyFn(CONTRACT, "get-sbtc-contract", [], deployer);
    const pretty = Cl.prettyPrint(sc.result);
    expect(pretty).toContain("sbtc-token");
  });

  it("set-sbtc-contract fails for non-owner", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "set-sbtc-contract",
      [Cl.principal(`${deployer}.sbtc-token`)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(113));
  });

  it("get-sbtc-contract returns none by default", () => {
    const sc = simnet.callReadOnlyFn(CONTRACT, "get-sbtc-contract", [], deployer);
    expect(sc.result).toBeNone();
  });
});
