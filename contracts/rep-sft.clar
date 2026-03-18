;; ========================================================================
;; STXWorx Badge & Verification NFT Contract v1
;; Two soulbound (non-transferable) SIP-009 NFTs:
;;   1. stxworx-badge  - Grade tiers (Bronze/Silver/Gold/Platinum), admin-minted
;;   2. stxworx-verified - Verification badge, backend-minted
;; ========================================================================

;; ======================== NFT DEFINITIONS ========================

(define-non-fungible-token stxworx-badge uint)
(define-non-fungible-token stxworx-verified uint)

;; ======================== CONSTANTS ========================

;; Grade tiers
(define-constant GRADE-BRONZE u1)
(define-constant GRADE-SILVER u2)
(define-constant GRADE-GOLD u3)
(define-constant GRADE-PLATINUM u4)

;; Error codes (u200+ to avoid collision with escrow u100-u131)
(define-constant ERR-NOT-ADMIN (err u200))
(define-constant ERR-NOT-BACKEND (err u201))
(define-constant ERR-NOT-AUTHORIZED (err u202))
(define-constant ERR-SOULBOUND (err u203))
(define-constant ERR-ALREADY-HAS-GRADE (err u204))
(define-constant ERR-NO-GRADE (err u205))
(define-constant ERR-INVALID-GRADE (err u206))
(define-constant ERR-GRADE-NOT-HIGHER (err u207))
(define-constant ERR-ALREADY-VERIFIED (err u208))
(define-constant ERR-NOT-VERIFIED (err u209))
(define-constant ERR-CONTRACT-PAUSED (err u210))
(define-constant ERR-SAME-ADMIN (err u211))
(define-constant ERR-NO-PENDING-ADMIN (err u212))

;; ======================== DATA VARIABLES ========================

(define-data-var contract-admin principal tx-sender)
(define-data-var pending-admin (optional principal) none)
(define-data-var backend-address principal tx-sender)
(define-data-var is-paused bool false)

;; Token ID counters
(define-data-var badge-id-nonce uint u0)
(define-data-var verified-id-nonce uint u0)

;; Base URIs for metadata
(define-data-var badge-base-uri (string-ascii 256) "https://api.stxworx.com/badges/")
(define-data-var verified-base-uri (string-ascii 256) "https://api.stxworx.com/verified/")

;; ======================== DATA MAPS ========================

;; Badge (grade) metadata: token-id -> details
(define-map badge-metadata uint {
  grade: uint,
  owner: principal,
  minted-at: uint,
  ipfs-cid: (string-ascii 64)

})

;; Reverse lookup: principal -> their grade token info (one grade per user)
(define-map user-grade principal {
  token-id: uint,
  grade: uint
})

;; Verified metadata: token-id -> details
(define-map verified-metadata uint {
  owner: principal,
  minted-at: uint,
  ipfs-cid: (string-ascii 64)

})

;; Reverse lookup: principal -> their verified token-id (one per user)
(define-map user-verified principal uint)

;; ======================== PRIVATE HELPERS ========================

(define-private (is-admin)
  (is-eq tx-sender (var-get contract-admin))
)

;; Uses contract-caller so intermediary contracts cannot impersonate the backend
(define-private (is-backend)
  (is-eq contract-caller (var-get backend-address))
)

(define-private (is-valid-grade (grade uint))
  (and (>= grade GRADE-BRONZE) (<= grade GRADE-PLATINUM))
)

(define-private (check-not-paused)
  (ok (asserts! (not (var-get is-paused)) ERR-CONTRACT-PAUSED))
)

;; ======================== PUBLIC: GRADE BADGE ========================

;; Admin mints a grade badge for a user (one per user)
(define-public (admin-mint-grade (recipient principal) (grade uint) (ipfs-cid (string-ascii 64)))
  (begin
    (try! (check-not-paused))
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (is-valid-grade grade) ERR-INVALID-GRADE)
    (asserts! (is-none (map-get? user-grade recipient)) ERR-ALREADY-HAS-GRADE)
    (asserts! (> (len ipfs-cid) u0) ERR-INVALID-GRADE)
    (let (
      (new-id (+ (var-get badge-id-nonce) u1))
    )
      (try! (nft-mint? stxworx-badge new-id recipient))
      (var-set badge-id-nonce new-id)
      (map-set badge-metadata new-id {
        grade: grade,
        owner: recipient,
        minted-at: burn-block-height,
        ipfs-cid: ipfs-cid

      })
      (map-set user-grade recipient {
        token-id: new-id,
        grade: grade
      })
      (print {
        event: "grade-minted",
        token-id: new-id,
        recipient: recipient,
        grade: grade,
        ipfs-cid: ipfs-cid
      })
      (ok new-id)
    )
  )
)

;; Admin upgrades a user's grade (burns old, mints new - must be higher)
(define-public (admin-upgrade-grade (user principal) (new-grade uint) (ipfs-cid (string-ascii 64)))
  (begin
    (try! (check-not-paused))
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (> (len ipfs-cid) u0) ERR-INVALID-GRADE)
    (asserts! (is-valid-grade new-grade) ERR-INVALID-GRADE)
    (asserts! (is-some (map-get? user-grade user)) ERR-NO-GRADE)
    (let (
      (current-info (unwrap! (map-get? user-grade user) ERR-NO-GRADE))
      (old-token-id (get token-id current-info))
      (old-grade (get grade current-info))
    )
      (asserts! (> new-grade old-grade) ERR-GRADE-NOT-HIGHER)
      ;; Burn old badge
      (try! (nft-burn? stxworx-badge old-token-id user))
      (map-delete badge-metadata old-token-id)
      ;; Mint new badge
      (let (
        (new-id (+ (var-get badge-id-nonce) u1))
      )
        (try! (nft-mint? stxworx-badge new-id user))
        (var-set badge-id-nonce new-id)
        (map-set badge-metadata new-id {
          grade: new-grade,
          owner: user,
          minted-at: burn-block-height,
          ipfs-cid: ipfs-cid

        })
        (map-set user-grade user {
          token-id: new-id,
          grade: new-grade
        })
        (print {
          event: "grade-upgraded",
          token-id: new-id,
          user: user,
          old-grade: old-grade,
          new-grade: new-grade
        })
        (ok new-id)
      )
    )
  )
)

;; Admin revokes (burns) a user's grade badge
(define-public (admin-revoke-grade (user principal))
  (begin
    (try! (check-not-paused))
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (is-some (map-get? user-grade user)) ERR-NO-GRADE)
    (let (
      (current-info (unwrap! (map-get? user-grade user) ERR-NO-GRADE))
      (token-id (get token-id current-info))
    )
      (try! (nft-burn? stxworx-badge token-id user))
      (map-delete badge-metadata token-id)
      (map-delete user-grade user)
      (print {
        event: "grade-revoked",
        token-id: token-id,
        user: user
      })
      (ok true)
    )
  )
)

;; Admin updates a badge's IPFS CID (e.g. new image/metadata)
(define-public (admin-update-badge-cid (token-id uint) (new-cid (string-ascii 64)))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (let (
      (info (unwrap! (map-get? badge-metadata token-id) ERR-NO-GRADE))
    )
      (map-set badge-metadata token-id (merge info { ipfs-cid: new-cid }))
      (print { event: "badge-cid-updated", token-id: token-id, new-cid: new-cid })
      (ok true)
    )
  )
)



;; ======================== PUBLIC: VERIFIED BADGE ========================

;; Backend mints a verified badge for a user (one per user)
(define-public (mint-verified (recipient principal) (ipfs-cid (string-ascii 64)))
  (begin
    (try! (check-not-paused))
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (is-none (map-get? user-verified recipient)) ERR-ALREADY-VERIFIED)
    (let (
      (new-id (+ (var-get verified-id-nonce) u1))
    )
      (try! (nft-mint? stxworx-verified new-id recipient))
      (var-set verified-id-nonce new-id)
      (map-set verified-metadata new-id {
        owner: recipient,
        minted-at: burn-block-height,
        ipfs-cid: ipfs-cid
      })
      (map-set user-verified recipient new-id)
      (print {
        event: "verified-minted",
        token-id: new-id,
        recipient: recipient,
        ipfs-cid: ipfs-cid
      })
      (ok new-id)
    )
  )
)

;; Admin or backend revokes a verified badge
(define-public (revoke-verified (user principal))
  (begin
    (try! (check-not-paused))
    (asserts! (or (is-admin) (is-backend)) ERR-NOT-AUTHORIZED)
    (let (
      (token-id (unwrap! (map-get? user-verified user) ERR-NOT-VERIFIED))
    )
      (try! (nft-burn? stxworx-verified token-id user))
      (map-delete verified-metadata token-id)
      (map-delete user-verified user)
      (print {
        event: "verified-revoked",
        token-id: token-id,
        user: user
      })
      (ok true)
    )
  )
)

;; ======================== SIP-009: SOULBOUND TRANSFERS ========================

;; Badge transfer - always fails (soulbound)
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  ERR-SOULBOUND
)

;; Verified transfer - always fails (soulbound)
(define-public (transfer-verified (token-id uint) (sender principal) (recipient principal))
  ERR-SOULBOUND
)

;; ======================== SIP-009: READ-ONLY ========================

(define-read-only (get-last-token-id)
  (ok (var-get badge-id-nonce))
)

(define-read-only (get-token-uri (token-id uint))
  (match (map-get? badge-metadata token-id)
    info (ok (some (concat "ipfs://" (get ipfs-cid info))))
    (ok none)
  )
)


(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? stxworx-badge token-id))
)

;; Verified SIP-009 read-only equivalents
(define-read-only (get-last-verified-id)
  (ok (var-get verified-id-nonce))
)

(define-read-only (get-verified-uri (token-id uint))
  (match (map-get? verified-metadata token-id)
    info (ok (some (concat "ipfs://" (get ipfs-cid info))))
    (ok none)
  )
)

(define-read-only (get-verified-owner (token-id uint))
  (ok (nft-get-owner? stxworx-verified token-id))
)

;; ======================== READ-ONLY: QUERIES ========================

;; Get a user's current grade info (or none)
(define-read-only (get-user-grade (user principal))
  (map-get? user-grade user)
)

;; Check if user has at minimum a given grade
(define-read-only (has-minimum-grade (user principal) (min-grade uint))
  (match (map-get? user-grade user)
    info (>= (get grade info) min-grade)
    false
  )
)

;; Check if user is verified
(define-read-only (is-user-verified (user principal))
  (is-some (map-get? user-verified user))
)

;; Get combined user profile: grade + verified status
(define-read-only (get-user-profile (user principal))
  (let (
    (grade-info (map-get? user-grade user))
    (verified-id (map-get? user-verified user))
  )
    {
      grade: (match grade-info info (some (get grade info)) none),
      grade-token-id: (match grade-info info (some (get token-id info)) none),
      is-verified: (is-some verified-id),
      verified-token-id: verified-id
    }
  )
)

;; Get badge metadata by token-id
(define-read-only (get-badge-info (token-id uint))
  (map-get? badge-metadata token-id)
)

;; Get verified metadata by token-id
(define-read-only (get-verified-info (token-id uint))
  (map-get? verified-metadata token-id)
)

;; ======================== PUBLIC: CONFIGURATION ========================

;; Set the backend address (admin only)
(define-public (set-backend-address (new-backend principal))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set backend-address new-backend)
    (print { event: "backend-address-updated", new-backend: new-backend })
    (ok true)
  )
)

;; Pause / unpause the contract (admin only)
(define-public (set-paused (paused bool))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set is-paused paused)
    (print { event: "pause-updated", paused: paused })
    (ok true)
  )
)

;; Set badge base URI (admin only)
(define-public (set-badge-uri (new-uri (string-ascii 256)))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set badge-base-uri new-uri)
    (print { event: "badge-uri-updated", uri: new-uri })
    (ok true)
  )
)

;; Set verified base URI (admin only)
(define-public (set-verified-uri (new-uri (string-ascii 256)))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set verified-base-uri new-uri)
    (print { event: "verified-uri-updated", uri: new-uri })
    (ok true)
  )
)

;; Propose a new admin (two-step transfer)
(define-public (propose-admin (new-admin principal))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (not (is-eq new-admin (var-get contract-admin))) ERR-SAME-ADMIN)
    (var-set pending-admin (some new-admin))
    (print { event: "admin-proposed", new-admin: new-admin })
    (ok true)
  )
)

;; Cancel a pending admin proposal (admin only)
(define-public (cancel-propose-admin)
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (is-some (var-get pending-admin)) ERR-NO-PENDING-ADMIN)
    (var-set pending-admin none)
    (print { event: "admin-proposal-cancelled" })
    (ok true)
  )
)

;; Accept admin role (called by the proposed admin)
(define-public (accept-admin)
  (let (
    (new-admin (unwrap! (var-get pending-admin) ERR-NO-PENDING-ADMIN))
  )
    (asserts! (is-eq tx-sender new-admin) ERR-NOT-AUTHORIZED)
    (var-set contract-admin new-admin)
    (var-set pending-admin none)
    (print { event: "admin-transferred", new-admin: new-admin })
    (ok true)
  )
)
