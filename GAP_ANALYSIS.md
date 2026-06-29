# Tradewind — Functional Gap Analysis (from Terova's point of view)

A critical, in-their-shoes review. Terova is a spice exporter that **does not directly control
logistics** — vendors/processors contract LSPs — and must cut Scope 3 downstream-transport CO₂e
**without breaking customer SLAs or spoiling perishable product, and without blowing freight cost**.
So every "reduce CO₂" decision is really a **3-way trade-off: CO₂ ↔ cost ↔ service (SLA/lead time)**,
made under **influence, not direct control**.

The single biggest theme below: the platform shows CO₂/distance/fuel well, but the **constraints
that actually gate Terova's decisions — SLA/lead time, product shelf-life, freight cost (₹/$ and
$/tonne-CO₂ abated), and who controls the lever — are under-modeled.**

Legend: ✅ addressed this iteration · 🟡 partial · ⛔ gap / roadmap.

---

## 1. Carbon Copilot (landing)
**Decision it serves:** "What should I look at / act on first today?"
- ✅ Grounded Q&A, persona focus KPIs, a "what changed" pulse, and now **live 2026 shipments** in the feed.
- ⛔ No **decisions-due queue**: planned 2026 shipments have a *booking cutoff* — Terova needs "N shipments need a mode decision before their cutoff date," sorted by deadline, not just a pulse.
- ⛔ No **what-if simulation** ("if I move all Europe lanes to rail-inland, what's the Q3 CO₂ / cost / SLA impact?").
- ⛔ No **target/budget burn-down** (annual CO₂ target vs actual; air-budget remaining).
- ⛔ Copilot recommends but cannot **write back** a decision to a TMS/ERP or notify the vendor/LSP.

## 2. Shipment Route Map
**Decision it serves:** "For this shipment/lane, which route & mode?"
- ✅ End-to-end routed legs over real sea corridors, per-leg CO₂e/distance/fuel/days/**vehicle count**, isolate-on-select, route-count control.
- ⛔ Routes are **modelled** (Haversine + chokepoints), not **actual carrier schedules**: no sailing frequency, **booking cutoffs, port congestion, or transit reliability** — all of which Terova needs to commit to a mode.
- ⛔ Can't **toggle the scenario on the map** (see the Best-for-CO₂ route redraw vs Current) or pick the optimization objective (min-CO₂ / min-cost / min-time) interactively.
- ⛔ No **consolidation decision** view (combine 3 part-loads into 1 container) even though multi-truck counts hint at it.
- ⛔ No risk layer (weather, congestion, geopolitical e.g. Red Sea/Suez re-routing via Cape).

## 3. Emission Hotspots
**Decision it serves:** "Where do I act first?"
- ✅ Ranked by CO₂e across product/customer/market/port/mode/vendor/LSP/origin.
- ⛔ **Static** — no trend (growing vs shrinking), no period-over-period movement, no target-vs-actual per hotspot.
- ⛔ No **controllable-vs-structural split** (how much of this hotspot can Terova actually influence?).
- ⛔ No **alternative intensity bases** (per kg, per $ revenue) that ESG and commercial teams need.
- ⛔ No drill-through hotspot → lanes → action (closed loop).

## 4. Customer & Product Lanes
**Decision it serves:** "Which customer-product lanes can go greener?"
- ✅ Emissions by product × customer × market with a sortable lane table.
- ⛔ **No SLA / lead-time tolerance per customer** — the decisive parameter. Best-for-CO₂ (4–6 wks) is only viable where the customer accepts it; that isn't captured.
- ⛔ **No product shelf-life / perishability constraint** — some ground spices/oleoresins can't take 6-week ocean; this should hard-gate mode choice.
- ⛔ **No revenue / margin per lane** — don't slow a high-margin, time-critical customer to save a little CO₂.

## 5. Carrier & Vendor Performance
**Decision it serves:** "Who do I influence, and how?" (Terova's main lever, since it outsources.)
- ✅ Vendor/LSP CO₂ contribution, intensity vs fleet, green-program flag, influenceable saving.
- ⛔ No **contract/volume context** (what share is committed vs spot), so "shift volume to greener LSP" isn't actionable.
- ⛔ No **scorecard over time**, **on-time reliability**, or **green-clause tracking** — needed both for the SLA decision and for governance.
- ⛔ No **engagement workflow** (RFQ, governance cadence, QBR) — recommendations don't convert into partner action.
- ⛔ No **market benchmark** (is this LSP actually above market, or just above our fleet avg?).

## 6. Reduction Opportunities & Action Tracker
**Decision it serves:** "Which actions do I commit to, and did they work?"
- ✅ Actions ranked by CO₂e × confidence; execute / delegate / snooze; decision write-back + audit; cost & SLA-risk shown per action.
- ⛔ **No hard SLA-feasibility gate** — an action that breaks a customer's lead time should be blocked/flagged, not just labelled "SLA risk: higher."
- ⛔ **No marginal abatement cost ($/tonne CO₂ abated)** ranking — Terova needs cost-efficiency, not just absolute tonnes.
- ⛔ **No estimated-vs-realized** tracking per action (the brief explicitly asks to prove realized reduction).
- ⛔ No **program bundling** with cumulative target tracking and owner accountability to closure/escalation.

## 7. Air Freight Watch
**Decision it serves:** "Which air moves were avoidable, and how do I prevent them?"
- ✅ Air exceptions classified avoidable/justified, ocean alternative + saving, data-quality flags.
- ⛔ **No root cause** (late PO, stockout, customer rush) — without the *why*, recurrence can't be prevented.
- ⛔ **No air budget / approval governance** or early-warning when a *planned* shipment is trending toward air.
- ⛔ **No air cost premium** shown beside the CO₂ — the cost case is half the argument to leadership.

## 8. ESG Reporting
**Decision it serves:** "Can I defend this number externally?"
- ✅ Baseline→realized→ambition, monthly trend, methodology, assumptions, export stub.
- ⛔ **No framework conformance** stated (GHG Protocol Scope 3 Cat 4/9, GLEC, ISO 14083) or **uncertainty bounds** — auditors will ask.
- ⛔ **No data-quality / primary-vs-modelled share** on the reported figure (today everything is modelled).
- ⛔ **No reduction attribution** linking the reported delta to the specific executed actions.

## 9. Methodology & Factors
- ✅ Transparent distance-based formula + factor table.
- ⛔ EFs are **global/assumed**; Terova's own call notes say factors differ by **region/vehicle/fuel** (India vs US roads). Needs region-specific, **version-controlled, source-cited** factors and **uncertainty propagation** from the ±5% Bing distances.

---

## Top cross-cutting gaps (priority order for Terova)
1. **Model SLA / lead-time & product shelf-life** as first-class constraints that *gate* every mode recommendation. Without this, "Best-for-CO₂" is advice Terova can't safely take.
2. **Add the cost axis properly** — freight cost delta everywhere + **$/tonne-CO₂ abated** to prioritize actions.
3. **Decisions-due queue tied to booking cutoffs** for live/planned shipments (turn "visibility" into "act before it sails").
4. **Influence workflow** (RFQ/governance to vendors & LSPs) since Terova doesn't control execution.
5. **Estimated-vs-realized tracking + reduction attribution** to prove the number for ESG.
6. **Real data**: carrier schedules/cutoffs, region-specific EFs, per-customer SLAs, per-lane margin — the app is decision-ready in shape but **illustrative until these land**.

_Addressed in this iteration: realistic sea routing, live 2026 shipment data + status, "Fastest" renamed (it is the highest-CO₂ option), clearer map (route-count control, no globe-repeat), ranked/ordered lane list with sort, and UI-overflow/clipping fixes._
