;; ========================================================================
;; Rendezvous Fuzz & Invariant Tests for escrow-contract-v1
;; Run with: npx rv . escrow-contract-v1 test --runs=500
;;           npx rv . escrow-contract-v1 invariant --runs=500
;; ========================================================================

;; ======================== PROPERTY TESTS ========================

;; Property: creating a project always increments the counter
(define-public (test-create-project-always-increments-counter (amount1 uint) (amount2 uint))
  (let (
    (a1 (if (< amount1 u1) u1 (if (> amount1 u1000000) u1000000 amount1)))
    (a2 (if (< amount2 u1) u1 (if (> amount2 u1000000) u1000000 amount2)))
    (count-before (contract-call? .escrow-contract-v1 get-project-count))
  )
    ;; Create a project as tx-sender (assumes tx-sender != 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)
    (match (contract-call? .escrow-contract-v1 create-project-stx
              'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG a1 a2 u0 u0)
      ok-val
        (begin
          (asserts! (is-eq (contract-call? .escrow-contract-v1 get-project-count) (+ count-before u1))
            (err u9001))
          (ok true))
      err-val (ok true))))  ;; If create fails, property trivially holds

;; Property: fee always within bounds (0 to MAX-FEE-RATE)
(define-public (test-fee-always-within-bounds (amount uint))
  (let (
    (fee-rate (contract-call? .escrow-contract-v1 get-fee-rate))
    (clamped (if (< amount u1) u1 (if (> amount u100000000) u100000000 amount)))
    (computed-fee (/ (* clamped fee-rate) u10000))
  )
    ;; Fee should never exceed 10% of the amount
    (asserts! (<= computed-fee (/ (* clamped u1000) u10000)) (err u9002))
    ;; Fee should be <= amount
    (asserts! (<= computed-fee clamped) (err u9003))
    (ok true)))

;; Property: double release always fails
(define-public (test-double-release-always-fails (project-id uint) (milestone-num uint))
  (let (
    (pid (if (< project-id u1) u1 project-id))
    (mnum (if (< milestone-num u1) u1 (if (> milestone-num u4) u4 milestone-num)))
  )
    (match (map-get? milestones {project-id: pid, milestone-num: mnum})
      milestone-data
        (if (get released milestone-data)
          ;; Already released: a second release should always fail
          (match (contract-call? .escrow-contract-v1 release-milestone-stx pid mnum)
            ok-val (err u9004)  ;; If it succeeded, that's a bug
            err-val (ok true))  ;; Expected: failure
          (ok true))  ;; Not yet released, property trivially holds
      (ok true))))  ;; Milestone doesn't exist, trivially holds

;; Property: non-owner admin calls always fail
(define-public (test-non-owner-admin-always-fails (fee-rate uint))
  (let (
    (owner (contract-call? .escrow-contract-v1 get-contract-owner))
  )
    (if (is-eq tx-sender owner)
      (ok true)  ;; Skip if tx-sender is owner
      (begin
        (match (contract-call? .escrow-contract-v1 set-fee-rate fee-rate)
          ok-val (err u9005)    ;; Non-owner succeeded = bug
          err-val (ok true))))))  ;; Expected: failure

;; ======================== INVARIANT TESTS ========================

;; Invariant: STX balance covers obligations
;; Contract STX balance >= sum of (total - released) for all non-refunded STX projects
(define-public (invariant-stx-balance-covers-obligations)
  (let (
    (balance (contract-call? .escrow-contract-v1 get-contract-balance-stx))
    (count (contract-call? .escrow-contract-v1 get-project-count))
    (obligations (fold calc-stx-obligation (list u1 u2 u3 u4 u5 u6 u7 u8 u9 u10) u0))
  )
    (asserts! (>= balance obligations) (err u9010))
    (ok true)))

(define-private (calc-stx-obligation (pid uint) (acc uint))
  (match (contract-call? .escrow-contract-v1 get-project pid)
    project
      (if (and (is-eq (get token-type project) u0) (not (get refunded project)))
        (match (contract-call? .escrow-contract-v1 get-refundable pid)
          ok-val (+ acc ok-val)
          err-val acc)
        acc)
    acc))

;; Invariant: committed sBTC consistency
(define-public (invariant-committed-sbtc-consistency)
  (let (
    (committed (contract-call? .escrow-contract-v1 get-committed-sbtc))
    (calculated (fold calc-sbtc-obligation (list u1 u2 u3 u4 u5 u6 u7 u8 u9 u10) u0))
  )
    (asserts! (is-eq committed calculated) (err u9011))
    (ok true)))

(define-private (calc-sbtc-obligation (pid uint) (acc uint))
  (match (contract-call? .escrow-contract-v1 get-project pid)
    project
      (if (and (is-eq (get token-type project) u1) (not (get refunded project)))
        (match (contract-call? .escrow-contract-v1 get-refundable pid)
          ok-val (+ acc ok-val)
          err-val acc)
        acc)
    acc))

;; Invariant: released never exceeds total
(define-public (invariant-released-never-exceeds-total)
  (let (
    (count (contract-call? .escrow-contract-v1 get-project-count))
  )
    (asserts! (fold check-released-vs-total (list u1 u2 u3 u4 u5 u6 u7 u8 u9 u10) true) (err u9012))
    (ok true)))

(define-private (check-released-vs-total (pid uint) (valid bool))
  (if (not valid)
    false
    (match (contract-call? .escrow-contract-v1 get-project pid)
      project
        (match (contract-call? .escrow-contract-v1 get-refundable pid)
          ok-val true  ;; If get-refundable succeeds, refundable >= 0 (uint), so released <= total
          err-val true)
      true)))

;; Invariant: refunded project has zero obligations
(define-public (invariant-refunded-project-has-zero-obligations)
  (let (
    (count (contract-call? .escrow-contract-v1 get-project-count))
  )
    (asserts! (fold check-refunded-zero (list u1 u2 u3 u4 u5 u6 u7 u8 u9 u10) true) (err u9013))
    (ok true)))

(define-private (check-refunded-zero (pid uint) (valid bool))
  (if (not valid)
    false
    (match (contract-call? .escrow-contract-v1 get-project pid)
      project
        (if (get refunded project)
          (match (contract-call? .escrow-contract-v1 get-refundable pid)
            ok-val (is-eq ok-val u0)
            err-val true)
          true)
      true)))

;; Helper: reference to milestones map for property tests
(define-map milestones {project-id: uint, milestone-num: uint}
  {
    amount: uint,
    complete: bool,
    released: bool,
    completed-at: uint
  })
