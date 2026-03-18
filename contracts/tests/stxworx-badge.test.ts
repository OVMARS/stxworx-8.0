import { describe, it, expect, beforeEach } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const CONTRACT = "rep-sft";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

// Grade constants
const GRADE_BRONZE = 1;
const GRADE_SILVER = 2;
const GRADE_GOLD = 3;
const GRADE_PLATINUM = 4;

// Test IPFS CIDs
const CID_BRONZE = "QmBronzeCID1234567890abcdefghijklmnopqrstuvwx";
const CID_SILVER = "QmSilverCID1234567890abcdefghijklmnopqrstuvwx";
const CID_GOLD = "QmGoldCIDxx1234567890abcdefghijklmnopqrstuvwx";
const CID_PLATINUM = "QmPlatinumCID34567890abcdefghijklmnopqrstuvwx";
const CID_VERIFIED = "QmVerifiedCID234567890abcdefghijklmnopqrstuvw";
const CID_UPDATED = "QmUpdatedCID234567890abcdefghijklmnopqrstuvwx";

// Error codes
const ERR_NOT_ADMIN = 200;
const ERR_NOT_BACKEND = 201;
const ERR_NOT_AUTHORIZED = 202;
const ERR_SOULBOUND = 203;
const ERR_ALREADY_HAS_GRADE = 204;
const ERR_NO_GRADE = 205;
const ERR_INVALID_GRADE = 206;
const ERR_GRADE_NOT_HIGHER = 207;
const ERR_ALREADY_VERIFIED = 208;
const ERR_NOT_VERIFIED = 209;
const ERR_CONTRACT_PAUSED = 210;
const ERR_SAME_ADMIN = 211;
const ERR_NO_PENDING_ADMIN = 212;

// ============================================================
// Helpers
// ============================================================

function mintGrade(sender: string, recipient: string, grade: number, cid: string = CID_BRONZE) {
  return simnet.callPublicFn(
    CONTRACT,
    "admin-mint-grade",
    [Cl.principal(recipient), Cl.uint(grade), Cl.stringAscii(cid)],
    sender
  );
}

function upgradeGrade(sender: string, user: string, newGrade: number, cid: string = CID_SILVER) {
  return simnet.callPublicFn(
    CONTRACT,
    "admin-upgrade-grade",
    [Cl.principal(user), Cl.uint(newGrade), Cl.stringAscii(cid)],
    sender
  );
}

function revokeGrade(sender: string, user: string) {
  return simnet.callPublicFn(
    CONTRACT,
    "admin-revoke-grade",
    [Cl.principal(user)],
    sender
  );
}

function mintVerified(sender: string, recipient: string, cid: string = CID_VERIFIED) {
  return simnet.callPublicFn(
    CONTRACT,
    "mint-verified",
    [Cl.principal(recipient), Cl.stringAscii(cid)],
    sender
  );
}

function revokeVerified(sender: string, user: string) {
  return simnet.callPublicFn(
    CONTRACT,
    "revoke-verified",
    [Cl.principal(user)],
    sender
  );
}

function readOnly(fn: string, args: any[] = []) {
  return simnet.callReadOnlyFn(CONTRACT, fn, args, deployer);
}

// ============================================================
// A. ADMIN MINTING
// ============================================================
describe("Admin Minting", () => {
  it("should mint a Bronze badge", () => {
    const { result } = mintGrade(deployer, wallet1, GRADE_BRONZE);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("should mint a Silver badge", () => {
    const { result } = mintGrade(deployer, wallet1, GRADE_SILVER);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("should mint a Gold badge", () => {
    const { result } = mintGrade(deployer, wallet1, GRADE_GOLD);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("should mint a Platinum badge", () => {
    const { result } = mintGrade(deployer, wallet1, GRADE_PLATINUM);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("should reject minting from non-admin", () => {
    const { result } = mintGrade(wallet1, wallet2, GRADE_BRONZE);
    expect(result).toBeErr(Cl.uint(ERR_NOT_ADMIN));
  });

  it("should reject duplicate grade for same user", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE);
    const { result } = mintGrade(deployer, wallet1, GRADE_SILVER);
    expect(result).toBeErr(Cl.uint(ERR_ALREADY_HAS_GRADE));
  });

  it("should reject invalid grade u0", () => {
    const { result } = mintGrade(deployer, wallet1, 0);
    expect(result).toBeErr(Cl.uint(ERR_INVALID_GRADE));
  });

  it("should reject invalid grade u5", () => {
    const { result } = mintGrade(deployer, wallet1, 5);
    expect(result).toBeErr(Cl.uint(ERR_INVALID_GRADE));
  });
});

// ============================================================
// B. SOULBOUND TRANSFERS
// ============================================================
describe("Soulbound", () => {
  it("should reject badge transfer", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "transfer",
      [Cl.uint(1), Cl.principal(wallet1), Cl.principal(wallet2)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(ERR_SOULBOUND));
  });

  it("should reject verified transfer", () => {
    mintVerified(deployer, wallet1);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "transfer-verified",
      [Cl.uint(1), Cl.principal(wallet1), Cl.principal(wallet2)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(ERR_SOULBOUND));
  });

  it("should reject transfer even from admin", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "transfer",
      [Cl.uint(1), Cl.principal(wallet1), Cl.principal(wallet2)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(ERR_SOULBOUND));
  });
});

// ============================================================
// C. BURN-AND-UPGRADE
// ============================================================
describe("Burn-and-Upgrade", () => {
  it("should upgrade Bronze to Silver", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE);
    const { result } = upgradeGrade(deployer, wallet1, GRADE_SILVER);
    expect(result).toBeOk(Cl.uint(2));
  });

  it("should upgrade Bronze to Platinum (skip tiers)", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE);
    const { result } = upgradeGrade(deployer, wallet1, GRADE_PLATINUM);
    expect(result).toBeOk(Cl.uint(2));
  });

  it("should upgrade Silver to Gold", () => {
    mintGrade(deployer, wallet1, GRADE_SILVER);
    const { result } = upgradeGrade(deployer, wallet1, GRADE_GOLD);
    expect(result).toBeOk(Cl.uint(2));
  });

  it("should reject downgrade Gold to Bronze", () => {
    mintGrade(deployer, wallet1, GRADE_GOLD);
    const { result } = upgradeGrade(deployer, wallet1, GRADE_BRONZE);
    expect(result).toBeErr(Cl.uint(ERR_GRADE_NOT_HIGHER));
  });

  it("should reject same-grade upgrade", () => {
    mintGrade(deployer, wallet1, GRADE_SILVER);
    const { result } = upgradeGrade(deployer, wallet1, GRADE_SILVER);
    expect(result).toBeErr(Cl.uint(ERR_GRADE_NOT_HIGHER));
  });

  it("should reject upgrade for user with no grade", () => {
    const { result } = upgradeGrade(deployer, wallet1, GRADE_GOLD);
    expect(result).toBeErr(Cl.uint(ERR_NO_GRADE));
  });

  it("should reject upgrade from non-admin", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE);
    const { result } = upgradeGrade(wallet2, wallet1, GRADE_SILVER);
    expect(result).toBeErr(Cl.uint(ERR_NOT_ADMIN));
  });
});

// ============================================================
// D. ADMIN REVOKE
// ============================================================
describe("Admin Revoke", () => {
  it("should revoke a grade badge", () => {
    mintGrade(deployer, wallet1, GRADE_SILVER);
    const { result } = revokeGrade(deployer, wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("should clear maps after revoke", () => {
    mintGrade(deployer, wallet1, GRADE_SILVER);
    revokeGrade(deployer, wallet1);
    const { result } = readOnly("get-user-grade", [Cl.principal(wallet1)]);
    expect(result).toBeNone();
  });

  it("should allow re-minting after revoke", () => {
    mintGrade(deployer, wallet1, GRADE_SILVER);
    revokeGrade(deployer, wallet1);
    const { result } = mintGrade(deployer, wallet1, GRADE_BRONZE);
    expect(result).toBeOk(Cl.uint(2)); // id 1 was minted then burned, re-mint gets id 2
  });
});

// ============================================================
// E. VERIFIED BADGE
// ============================================================
describe("Verified Badge", () => {
  it("should mint a verified badge (backend)", () => {
    const { result } = mintVerified(deployer, wallet1);
    expect(result).toBeOk(Cl.uint(1));
  });

  it("should reject verified mint from non-admin", () => {
    const { result } = mintVerified(wallet1, wallet2);
    expect(result).toBeErr(Cl.uint(ERR_NOT_ADMIN));
  });

  it("should reject duplicate verified badge", () => {
    mintVerified(deployer, wallet1);
    const { result } = mintVerified(deployer, wallet1);
    expect(result).toBeErr(Cl.uint(ERR_ALREADY_VERIFIED));
  });

  it("should revoke a verified badge", () => {
    mintVerified(deployer, wallet1);
    const { result } = revokeVerified(deployer, wallet1);
    expect(result).toBeOk(Cl.bool(true));
  });

  it("should reject revoke for non-verified user", () => {
    const { result } = revokeVerified(deployer, wallet1);
    expect(result).toBeErr(Cl.uint(ERR_NOT_VERIFIED));
  });

  it("should allow grade + verified to coexist", () => {
    mintGrade(deployer, wallet1, GRADE_GOLD);
    mintVerified(deployer, wallet1);
    const { result: gradeResult } = readOnly("get-user-grade", [
      Cl.principal(wallet1),
    ]);
    expect(gradeResult).toBeSome(
      Cl.tuple({ "token-id": Cl.uint(1), grade: Cl.uint(GRADE_GOLD) })
    );
    const { result: verifiedResult } = readOnly("is-user-verified", [
      Cl.principal(wallet1),
    ]);
    expect(verifiedResult).toBeBool(true);
  });
});

// ============================================================
// F. READ-ONLY QUERIES
// ============================================================
describe("Read-Only Queries", () => {
  it("get-user-grade returns correct grade", () => {
    mintGrade(deployer, wallet1, GRADE_GOLD);
    const { result } = readOnly("get-user-grade", [Cl.principal(wallet1)]);
    expect(result).toBeSome(
      Cl.tuple({
        "token-id": Cl.uint(1),
        grade: Cl.uint(GRADE_GOLD),
      })
    );
  });

  it("has-minimum-grade returns true when met", () => {
    mintGrade(deployer, wallet1, GRADE_GOLD);
    const { result } = readOnly("has-minimum-grade", [
      Cl.principal(wallet1),
      Cl.uint(GRADE_SILVER),
    ]);
    expect(result).toBeBool(true);
  });

  it("has-minimum-grade returns false when not met", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE);
    const { result } = readOnly("has-minimum-grade", [
      Cl.principal(wallet1),
      Cl.uint(GRADE_GOLD),
    ]);
    expect(result).toBeBool(false);
  });

  it("has-minimum-grade returns false for user with no grade", () => {
    const { result } = readOnly("has-minimum-grade", [
      Cl.principal(wallet1),
      Cl.uint(GRADE_BRONZE),
    ]);
    expect(result).toBeBool(false);
  });

  it("is-user-verified returns correct status", () => {
    const { result: before } = readOnly("is-user-verified", [
      Cl.principal(wallet1),
    ]);
    expect(before).toBeBool(false);
    mintVerified(deployer, wallet1);
    const { result: after } = readOnly("is-user-verified", [
      Cl.principal(wallet1),
    ]);
    expect(after).toBeBool(true);
  });

  it("get-user-profile returns combined grade + verified", () => {
    mintGrade(deployer, wallet1, GRADE_GOLD);
    mintVerified(deployer, wallet1);
    const { result } = readOnly("get-user-profile", [Cl.principal(wallet1)]);
    expect(result).toBeTuple({
      grade: Cl.some(Cl.uint(GRADE_GOLD)),
      "grade-token-id": Cl.some(Cl.uint(1)),
      "is-verified": Cl.bool(true),
      "verified-token-id": Cl.some(Cl.uint(1)),
    });
  });

  it("get-user-profile returns empty for unknown user", () => {
    const { result } = readOnly("get-user-profile", [Cl.principal(wallet1)]);
    expect(result).toBeTuple({
      grade: Cl.none(),
      "grade-token-id": Cl.none(),
      "is-verified": Cl.bool(false),
      "verified-token-id": Cl.none(),
    });
  });

  it("get-badge-info returns metadata by token-id", () => {
    mintGrade(deployer, wallet1, GRADE_SILVER);
    const { result } = readOnly("get-badge-info", [Cl.uint(1)]);
    expect(result.type).toBe(ClarityType.OptionalSome);
    const inner = (result as any).value.value;
    expect(inner.grade).toBeUint(GRADE_SILVER);
    expect(inner.owner).toBePrincipal(wallet1);
  });

  it("get-badge-info returns none for burned token", () => {
    mintGrade(deployer, wallet1, GRADE_SILVER);
    revokeGrade(deployer, wallet1);
    const { result } = readOnly("get-badge-info", [Cl.uint(1)]);
    expect(result).toBeNone();
  });
});

// ============================================================
// G. CONFIGURATION
// ============================================================
describe("Configuration", () => {
  it("should set backend address", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "set-backend-address",
      [Cl.principal(wallet3)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
  });

  it("should reject set-backend-address from non-admin", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "set-backend-address",
      [Cl.principal(wallet3)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(ERR_NOT_ADMIN));
  });

  it("should transfer admin via propose + accept", () => {
    // Propose
    const { result: proposeResult } = simnet.callPublicFn(
      CONTRACT,
      "propose-admin",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(proposeResult).toBeOk(Cl.bool(true));
    // Accept
    const { result: acceptResult } = simnet.callPublicFn(
      CONTRACT,
      "accept-admin",
      [],
      wallet1
    );
    expect(acceptResult).toBeOk(Cl.bool(true));
    // Old admin can no longer mint
    const { result: oldAdminMint } = mintGrade(deployer, wallet2, GRADE_BRONZE);
    expect(oldAdminMint).toBeErr(Cl.uint(ERR_NOT_ADMIN));
    // New admin can mint
    const { result: newAdminMint } = mintGrade(wallet1, wallet2, GRADE_BRONZE);
    expect(newAdminMint).toBeOk(Cl.uint(1));
  });

  it("should cancel a pending admin proposal", () => {
    // Propose
    simnet.callPublicFn(
      CONTRACT,
      "propose-admin",
      [Cl.principal(wallet1)],
      deployer
    );
    // Cancel
    const { result: cancelResult } = simnet.callPublicFn(
      CONTRACT,
      "cancel-propose-admin",
      [],
      deployer
    );
    expect(cancelResult).toBeOk(Cl.bool(true));
    // Accept should now fail
    const { result: acceptResult } = simnet.callPublicFn(
      CONTRACT,
      "accept-admin",
      [],
      wallet1
    );
    expect(acceptResult).toBeErr(Cl.uint(ERR_NO_PENDING_ADMIN));
  });

  it("should reject cancel when no proposal pending", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "cancel-propose-admin",
      [],
      deployer
    );
    expect(result).toBeErr(Cl.uint(ERR_NO_PENDING_ADMIN));
  });

  it("should pause and unpause contract", () => {
    // Pause
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(true)], deployer);
    // Minting should fail
    const { result: mintResult } = mintGrade(deployer, wallet1, GRADE_BRONZE);
    expect(mintResult).toBeErr(Cl.uint(ERR_CONTRACT_PAUSED));
    // Unpause
    simnet.callPublicFn(CONTRACT, "set-paused", [Cl.bool(false)], deployer);
    // Minting should work
    const { result: mintResult2 } = mintGrade(deployer, wallet1, GRADE_BRONZE);
    expect(mintResult2).toBeOk(Cl.uint(1));
  });

  it("should reject propose-admin with same admin", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "propose-admin",
      [Cl.principal(deployer)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(ERR_SAME_ADMIN));
  });

  it("should reject accept-admin from wrong caller", () => {
    simnet.callPublicFn(
      CONTRACT,
      "propose-admin",
      [Cl.principal(wallet1)],
      deployer
    );
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "accept-admin",
      [],
      wallet2
    );
    expect(result).toBeErr(Cl.uint(ERR_NOT_AUTHORIZED));
  });
});

// ============================================================
// H. EVENTS (PRINT)
// ============================================================
describe("Events", () => {
  it("should emit grade-minted event with ipfs-cid", () => {
    const { events } = mintGrade(deployer, wallet1, GRADE_BRONZE, CID_BRONZE);
    const printEvents = events.filter((e: any) => e.event === "print_event");
    expect(printEvents.length).toBeGreaterThan(0);
    const data = printEvents[0].data.value;
    expect(data).toBeTuple({
      event: Cl.stringAscii("grade-minted"),
      "token-id": Cl.uint(1),
      recipient: Cl.principal(wallet1),
      grade: Cl.uint(GRADE_BRONZE),
      "ipfs-cid": Cl.stringAscii(CID_BRONZE),
    });
  });

  it("should emit verified-minted event with ipfs-cid", () => {
    const { events } = mintVerified(deployer, wallet1, CID_VERIFIED);
    const printEvents = events.filter((e: any) => e.event === "print_event");
    expect(printEvents.length).toBeGreaterThan(0);
    const data = printEvents[0].data.value;
    expect(data).toBeTuple({
      event: Cl.stringAscii("verified-minted"),
      "token-id": Cl.uint(1),
      recipient: Cl.principal(wallet1),
      "ipfs-cid": Cl.stringAscii(CID_VERIFIED),
    });
  });
});

// ============================================================
// I. IPFS INTEGRATION
// ============================================================
describe("IPFS Integration", () => {
  it("get-token-uri returns ipfs:// URI after mint", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE, CID_BRONZE);
    const { result } = readOnly("get-token-uri", [Cl.uint(1)]);
    expect(result).toBeOk(Cl.some(Cl.stringAscii("ipfs://" + CID_BRONZE)));
  });

  it("get-token-uri returns none for non-existent token", () => {
    const { result } = readOnly("get-token-uri", [Cl.uint(999)]);
    expect(result).toBeOk(Cl.none());
  });

  it("get-verified-uri returns ipfs:// URI after mint", () => {
    mintVerified(deployer, wallet1, CID_VERIFIED);
    const { result } = readOnly("get-verified-uri", [Cl.uint(1)]);
    expect(result).toBeOk(Cl.some(Cl.stringAscii("ipfs://" + CID_VERIFIED)));
  });

  it("get-verified-uri returns none for non-existent token", () => {
    const { result } = readOnly("get-verified-uri", [Cl.uint(999)]);
    expect(result).toBeOk(Cl.none());
  });

  it("upgrade updates the IPFS CID on new token", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE, CID_BRONZE);
    upgradeGrade(deployer, wallet1, GRADE_GOLD, CID_GOLD);
    // New token (id 2) has gold CID
    const { result: newUri } = readOnly("get-token-uri", [Cl.uint(2)]);
    expect(newUri).toBeOk(Cl.some(Cl.stringAscii("ipfs://" + CID_GOLD)));
    // Old token (id 1) is burned, returns none
    const { result: oldUri } = readOnly("get-token-uri", [Cl.uint(1)]);
    expect(oldUri).toBeOk(Cl.none());
  });

  it("admin-update-badge-cid updates an existing badge CID", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE, CID_BRONZE);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-update-badge-cid",
      [Cl.uint(1), Cl.stringAscii(CID_UPDATED)],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));
    const { result: uri } = readOnly("get-token-uri", [Cl.uint(1)]);
    expect(uri).toBeOk(Cl.some(Cl.stringAscii("ipfs://" + CID_UPDATED)));
  });

  it("admin-update-badge-cid rejects non-existent token", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-update-badge-cid",
      [Cl.uint(999), Cl.stringAscii(CID_UPDATED)],
      deployer
    );
    expect(result).toBeErr(Cl.uint(ERR_NO_GRADE));
  });

  it("admin-update-badge-cid rejects non-admin", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE, CID_BRONZE);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "admin-update-badge-cid",
      [Cl.uint(1), Cl.stringAscii(CID_UPDATED)],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(ERR_NOT_ADMIN));
  });

  it("rejects empty IPFS CID on mint", () => {
    const { result } = mintGrade(deployer, wallet1, GRADE_BRONZE, "");
    expect(result).toBeErr(Cl.uint(ERR_INVALID_GRADE));
  });

  it("revoke clears token URI", () => {
    mintGrade(deployer, wallet1, GRADE_BRONZE, CID_BRONZE);
    revokeGrade(deployer, wallet1);
    const { result } = readOnly("get-token-uri", [Cl.uint(1)]);
    expect(result).toBeOk(Cl.none());
  });

  it("revoke verified clears verified URI", () => {
    mintVerified(deployer, wallet1, CID_VERIFIED);
    revokeVerified(deployer, wallet1);
    const { result } = readOnly("get-verified-uri", [Cl.uint(1)]);
    expect(result).toBeOk(Cl.none());
  });

  it("get-badge-info includes ipfs-cid field", () => {
    mintGrade(deployer, wallet1, GRADE_SILVER, CID_SILVER);
    const { result } = readOnly("get-badge-info", [Cl.uint(1)]);
    expect(result.type).toBe(ClarityType.OptionalSome);
    const inner = (result as any).value.value;
    expect(inner["ipfs-cid"]).toBeAscii(CID_SILVER);
  });
});
