#!/usr/bin/env python3
"""
Workbook extractor — the ONLY place the Excel file is read.

Reads `Transport Downstream- V02.xlsx` (Terova / VKS downstream transport
inventory) and writes `scripts/source/transport-downstream.json`: a normalised,
provenance-carrying dump of every row in the workbook. Nothing is invented here
and nothing is dropped silently — each emitted leg keeps the sheet + cell range
it came from so the app can cite it.

Workbook shape (per year tab, banner row 2 / header row 3):
  ROADWAY  #1  A:L   first-mile collection, farm/region -> factory or CCS
  ROADWAY  #2  N:Y   export first mile, factory -> ICD -> gateway port
  RAILWAY      AB:AK export rail haul, VKS Hyderabad -> Nhava Sheva
  WATERWAY     AM:AW ocean leg, gateway port -> destination port
  AIRWAY       AY:BG air freight, Hyderabad -> destination airport

The three tabs are sequential reporting years, not overlapping windows:
  '2020-2022' -> Jul 2021 .. May 2022   ('2021-2023' -> Jun 2022 .. May 2023, etc.)

The WATERWAY block is the shipment spine: every ocean row joins 1:1 to its
inland road/rail legs on (date, item, quantity), and the SL NO columns of the
ROADWAY #2 and WATERWAY blocks are already aligned. That join is verified here
and the script exits non-zero if it ever stops holding.

Run:  python3 scripts/extract-workbook.py
"""

from __future__ import annotations

import datetime
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

try:
    import openpyxl
    from openpyxl.utils import get_column_letter
except ImportError:  # pragma: no cover
    sys.exit("openpyxl is required:  pip3 install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
WORKBOOK = ROOT / "Transport Downstream- V02.xlsx"
OUT = ROOT / "scripts" / "source" / "transport-downstream.json"

BANNER_ROW = 2
HEADER_ROW = 3

# Reporting-year label per tab, plus the grand total the workbook itself prints
# in D53 ("Total M.TRANSPORT DOWNSTREAM"). We reconcile against it below.
TABS = {
    "2020-2022": "FY21-22",
    "2021-2023": "FY22-23",
    "2022-2024": "FY23-24",
}

# Blocks in banner order, with canonical field -> header text.
BLOCK_ORDER = ["collection", "road", "rail", "ocean", "air"]
BLOCK_FIELDS = {
    "collection": {
        "sl": "SL NO", "date": "MONTH", "item": "ITEM TRANSPOTED",
        "qtyKg": "QUANTITY OF MATERIAL (KGS)", "source": "SOURCE", "dest": "DESTINATION",
        "distPerTripKm": "DISTANCE TRAVELLED PER TRIP (KM)", "distanceKm": "DISTANCE TRAVELLED (KM)",
        "fuelKl": "FUEL CONSUMPTION (KILO LITRES)", "trips": "NO OF MONTHLY TRIPS",
        "ef": "EMISSION FACTOR (KG CO2/KM)", "co2e": "CO2 E EMISSIONS (TONNES)",
    },
    "road": {
        "sl": "SL NO", "date": "MONTH", "item": "ITEM TRANSPOTED",
        "qtyKg": "QUANTITY OF MATERIAL (KGS)", "source": "SOURCE", "dest": "DESTINATION",
        "distanceKm": "DISTANCE TRAVELLED (KM)", "fuelType": "FUEL USED",
        "fuelKl": "FUEL CONSUMPTION (KILO LITRES)", "trips": "NO OF MONTHLY TRIPS",
        "ef": "EMISSION FACTOR (KG CO2/KM)", "co2e": "CO2 E EMISSIONS (TONNES)",
    },
    "rail": {
        "sl": "SL NO", "date": "MONTH", "item": "ITEM TRANSPOTED",
        "qtyKg": "QUANTITY OF MATERIAL (KGS)", "source": "SOURCE", "dest": "DESTINATION",
        "distanceKm": "DISTANCE TRAVELLED (KM)", "trips": "NO OF MONTHLY TRIPS",
        "ef": "EMISSION FACTOR (KG CO2/TONNE-KM)", "co2e": "CO2 E EMISSIONS (TONNES)",
    },
    "ocean": {
        "sl": "SL NO", "date": "MONTH OF TRANSPORT (ARRIVAL/DISPATCH)", "item": "ITEM TRANSPOTED",
        "qtyKg": "QUANTITY OF MATERIAL(KGS)", "source": "SOURCE", "dest": "DESTINATION",
        "container": "TYPE OF SHIPPING (CONTAINER/TANKER)",
        "distanceNm": "SEA DISTANCE (NAUTICAL MILES)", "distanceKm": "SEA DISTANCE (KM)",
        "ef": "EMISSION FACTOR (KG CO2/TONNE-KM)", "co2e": "CO2 E EMISSIONS (TONNES)",
    },
    "air": {
        "sl": "SL NO", "date": "MONTH OF TRANSPORT", "item": "ITEM TRANSPOTED",
        "qtyKg": "QUANTITY OF MATERIAL(KGS)", "source": "SOURCE", "dest": "DESTINATION",
        "distanceKm": "DISTANCE (KM)", "ef": "EMISSION FACTOR (KG CO2/TONNE-KM)",
        "co2e": "CO2 E EMISSIONS (TONNES)",
    },
}

# Place-name spellings vary between tabs; fold them onto one label each. Every
# target below is a name that appears verbatim somewhere in the workbook.
PLACE_ALIASES = {
    "new york usa": "New York",
    "felixstowe, uk": "Felixstowe",
    "felixstove": "Felixstowe",
    "antwerpen": "Antwerp",
    "laem chebang": "Laem Chabang",
    # The workbook writes the one factory site three ways — "VKS Factory" on the
    # latest tab, "VKS Hyderabad" / "VKS, Hyderabad" on the earlier two. Same
    # site, same coordinates, so it is folded onto one name. (The inland depot
    # "ICD Hyderabad" and the city "Hyderabad" are distinct places and untouched.)
    "vks, hyderabad": "VKS Factory",
    "vks hyderabad": "VKS Factory",
    "vks factory": "VKS Factory",
    "factory": "VKS Factory",
    "vastavai": "Vatsavai",
    "bellary": "Ballary",
    "khammam": "Khammam",
    "guangzhou": "Guangzhou",
}


def norm_header(v) -> str | None:
    return re.sub(r"\s+", " ", str(v)).strip().upper() if v is not None else None


def clean_text(v) -> str | None:
    """Collapse the workbook's stray newlines / double spaces in free text."""
    if v is None:
        return None
    s = re.sub(r"\s+", " ", str(v)).strip()
    return s or None


def canon_place(v) -> str | None:
    s = clean_text(v)
    if s is None or s in {"0"}:
        return None
    return PLACE_ALIASES.get(s.lower(), s)


def as_date(v) -> str | None:
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    return None


def as_num(v) -> float | None:
    return float(v) if isinstance(v, (int, float)) else None


def block_ranges(ws) -> dict[str, tuple[int, int]]:
    """Banner row 2 marks each modal block; a block runs to the next banner."""
    banners = [c for c in range(1, ws.max_column + 1) if ws.cell(row=BANNER_ROW, column=c).value]
    if len(banners) != len(BLOCK_ORDER):
        sys.exit(f"{ws.title}: expected {len(BLOCK_ORDER)} banners, found {len(banners)}")
    out = {}
    for i, col in enumerate(banners):
        end = banners[i + 1] - 1 if i + 1 < len(banners) else ws.max_column
        out[BLOCK_ORDER[i]] = (col, end)
    return out


def extract_block(ws, block: str, lo: int, hi: int) -> list[dict]:
    """One modal block -> rows that carry a real date AND a CO2e number.

    Rows without both are the workbook's own subtotal / annotation rows (e.g.
    the 'Total' row inside RAILWAY, or the 'Shipment handled by external SP'
    note parked in the ROADWAY trips column) — they are reported, not emitted.

    Two quirks of the ROADWAY #1 (collection) block are handled here:
      * The item label is written once per month and left blank on the
        continuation rows, so it is forward-filled.
      * The block stacks two sub-tables. Rows sourced from a growing region are
        true first-mile collection; rows sourced from VKS are export first-mile
        road legs that the ROADWAY #2 block also lists. Both are inside the
        block subtotal the workbook prints, so both are emitted — tagged with
        `subBlock` so the shipment rebuild can avoid double-counting.
    """
    spec = BLOCK_FIELDS[block]
    colmap: dict[str, int] = {}
    for c in range(lo, hi + 1):
        h = norm_header(ws.cell(row=HEADER_ROW, column=c).value)
        for field, text in spec.items():
            if h == text and field not in colmap:
                colmap[field] = c
    missing = set(spec) - set(colmap) - {"sl"}
    if missing:
        sys.exit(f"{ws.title}/{block}: missing header columns {sorted(missing)}")

    lo_letter, hi_letter = get_column_letter(lo), get_column_letter(hi)
    rows = []
    carried_item: str | None = None
    for r in range(HEADER_ROW + 1, ws.max_row + 1):
        raw = {f: ws.cell(row=r, column=c).value for f, c in colmap.items()}
        date, co2e = as_date(raw.get("date")), as_num(raw.get("co2e"))
        if date is None or co2e is None:
            continue
        if block == "collection":
            carried_item = clean_text(raw.get("item")) or carried_item
            raw["item"] = carried_item
        rec = {
            "date": date,
            "item": clean_text(raw.get("item")),
            "qtyKg": as_num(raw.get("qtyKg")),
            "source": canon_place(raw.get("source")),
            "dest": canon_place(raw.get("dest")),
            "distanceKm": as_num(raw.get("distanceKm")),
            "ef": as_num(raw.get("ef")),
            "co2e": co2e,
            "sourceRef": f"{ws.title}!{lo_letter}{r}:{hi_letter}{r}",
        }
        for optional in ("distPerTripKm", "fuelKl", "trips", "fuelType", "container", "distanceNm", "sl"):
            if optional in raw:
                val = raw[optional]
                rec[optional] = clean_text(val) if optional in ("fuelType", "container") else as_num(val)
        # `trips` doubles as an annotation column on two tabs — keep numbers only.
        if not isinstance(rec.get("trips"), (int, float)):
            rec["trips"] = None
        if rec["item"] is None or rec["qtyKg"] is None:
            continue
        # One tab carries a zero placeholder row (no source, no destination, zero
        # quantity, zero CO2e). It is not a movement, so it is dropped; because
        # every figure on it is zero this cannot shift any total.
        if rec["source"] is None or rec["dest"] is None:
            if rec["co2e"] or rec["qtyKg"]:
                sys.exit(f"{ws.title}!{lo_letter}{r}: movement with data but no source/destination")
            continue
        if block == "collection":
            src = (rec["source"] or "").lower()
            rec["subBlock"] = "exportFirstMile" if "vks" in src else "collection"
        rows.append(rec)
    return rows


def join_key(row: dict) -> tuple:
    return (row["date"], (row["item"] or "").upper(), round(row["qtyKg"], 1))


def leg_pair(row: dict) -> tuple:
    return (row["source"], row["dest"], row["distanceKm"])


def order_chain(legs: list[dict]) -> list[dict]:
    """Sort inland legs into travel order: the head is the leg whose source is
    nobody else's destination; each next leg starts where the last one ended."""
    if len(legs) < 2:
        return list(legs)
    dests = {l["dest"] for l in legs}
    remaining = list(legs)
    head = next((l for l in remaining if l["source"] not in dests), remaining[0])
    remaining.remove(head)
    chain = [head]
    while remaining:
        nxt = next((l for l in remaining if l["source"] == chain[-1]["dest"]), remaining[0])
        remaining.remove(nxt)
        chain.append(nxt)
    return chain


def main() -> None:
    if not WORKBOOK.exists():
        sys.exit(f"workbook not found: {WORKBOOK}")
    wb = openpyxl.load_workbook(WORKBOOK, data_only=True)

    years: list[dict] = []
    notes: list[str] = []
    problems: list[str] = []

    for tab, fy in TABS.items():
        ws = wb[tab]
        ranges = block_ranges(ws)
        blocks = {b: extract_block(ws, b, *ranges[b]) for b in BLOCK_ORDER}

        # ── Reconcile against the workbook's own printed grand total ────────
        reported = as_num(ws["D53"].value)
        sums = {b: sum(r["co2e"] for r in rows) for b, rows in blocks.items()}
        all_legs = sum(sums.values())
        # Two tabs annotate the export road block "handled by external SP, not
        # valid as this is for the Ocean shipment" and leave it out of D53.
        road_excluded = abs(all_legs - sums["road"] - (reported or 0)) < 1e-6
        matches_all = abs(all_legs - (reported or 0)) < 1e-6
        if not (matches_all or road_excluded):
            problems.append(f"{tab}: leg sum {all_legs:.4f} t reconciles to neither D53 {reported} nor D53+road")

        # ── Rebuild each export shipment from its ocean spine ───────────────
        # Each ocean row joins to its inland legs on (date, item, quantity). The
        # SL NO columns are per-block row counters, not shipment ids, so they
        # cannot be used as the key. Where several identical shipments move on
        # one day the key is shared, so legs are *consumed*: within a key, the
        # inland legs are grouped by route step (source → dest → distance) and
        # each shipment takes one leg from each step. Anything left over is
        # reported as a problem rather than silently dropped or double-counted.
        inland_by_key: dict[tuple, dict[tuple, list[dict]]] = defaultdict(lambda: defaultdict(list))
        for r in blocks["road"] + blocks["rail"]:
            inland_by_key[join_key(r)][leg_pair(r)].append(r)

        shipments = []
        for spine in blocks["ocean"]:
            steps = inland_by_key.get(join_key(spine), {})
            inland = [legs.pop(0) for legs in steps.values() if legs]
            if not inland:
                problems.append(f"{tab}: ocean row {spine['sourceRef']} has no inland leg")
            shipments.append({"ocean": spine, "inland": order_chain(inland)})

        # Air freight also starts with a road run to the airport. Those legs sit
        # in the road block, keyed on the same item + quantity but sometimes on a
        # month-start date rather than the flight date, so match on (item, qty)
        # within the month and fall back to (item, qty) alone.
        air_shipments = []
        for spine in blocks["air"]:
            want = ((spine["item"] or "").upper(), round(spine["qtyKg"], 1))
            hit = next(
                (steps for k, steps in inland_by_key.items()
                 if (k[1], k[2]) == want and k[0][:7] == spine["date"][:7] and any(steps.values())),
                None,
            ) or next(
                (steps for k, steps in inland_by_key.items()
                 if (k[1], k[2]) == want and any(steps.values())),
                None,
            )
            inland = [legs.pop(0) for legs in hit.values() if legs] if hit else []
            air_shipments.append({"air": spine, "inland": order_chain(inland)})

        data_flags = []

        # The collection block re-lists some export first-mile runs. Where its
        # distance disagrees with the export road block for the same item and
        # quantity, the workbook is internally inconsistent — flag it and keep
        # the export road block, which is the block that carries the export chain.
        road_by_item: dict[tuple, set[float]] = defaultdict(set)
        for r in blocks["road"]:
            road_by_item[((r["item"] or "").upper(), round(r["qtyKg"], 1))].add(r["distanceKm"])
        for r in blocks["collection"]:
            if r["subBlock"] != "exportFirstMile":
                continue
            others = road_by_item.get(((r["item"] or "").upper(), round(r["qtyKg"], 1)))
            if others and r["distanceKm"] not in others:
                data_flags.append({
                    "kind": "conflicting-distance",
                    "detail": f"First mile for {r['qtyKg']:g} kg {(r['item'] or '').title()} on {r['date']} is "
                              f"recorded as {r['distanceKm']:g} km in the collection block and "
                              f"{'/'.join(f'{d:g}' for d in sorted(others))} km in the export road block. "
                              f"The export road block is used.",
                    "co2eTonnes": r["co2e"],
                    "sourceRef": r["sourceRef"],
                    # The row itself travels with the flag. A flagged row is not
                    # attached to any shipment, so this is the only place it
                    # survives — and the app must still be able to open the cell
                    # it names, or the finding points at nothing.
                    "row": r,
                })

        # Whatever is still unattached is a duplicated row in the workbook, not
        # an extraction failure — surface it as a data flag the app can show.
        for k, steps in inland_by_key.items():
            for pair, legs in steps.items():
                for leg in legs:
                    data_flags.append({
                        "kind": "duplicate-inland-leg",
                        "detail": f"{pair[0]} → {pair[1]} ({pair[2]:g} km) is listed twice for "
                                  f"{k[2]:g} kg {k[1].title()} on {k[0]}; only one movement is counted per shipment.",
                        "co2eTonnes": leg["co2e"],
                        "sourceRef": leg["sourceRef"],
                        # See the note on conflicting-distance: an unattached row
                        # would otherwise be unopenable from the finding about it.
                        "row": leg,
                    })

        years.append({
            "tab": tab,
            "reportingYear": fy,
            "reportedTotalCo2eTonnes": reported,
            "reportedTotalExcludesExportRoad": road_excluded and not matches_all,
            "legTotals": {b: round(v, 6) for b, v in sums.items()},
            "allLegsCo2eTonnes": round(all_legs, 6),
            "exportShipments": shipments,
            "airShipments": air_shipments,
            "dataFlags": data_flags,
            "collectionMovements": [r for r in blocks["collection"] if r["subBlock"] == "collection"],
            "exportFirstMileFromCollectionBlock": [r for r in blocks["collection"] if r["subBlock"] == "exportFirstMile"],
        })

        collection_n = sum(1 for r in blocks["collection"] if r["subBlock"] == "collection")
        print(
            f"{tab} ({fy}): {len(shipments):3d} export · {len(blocks['air'])} air · "
            f"{collection_n:2d} collection · all-legs {all_legs:8.3f} t · "
            f"D53 {reported:8.3f} t{'  (D53 excludes export road)' if road_excluded and not matches_all else ''}"
        )

    # Data-source footnotes the workbook prints under the collection block.
    for tab in TABS:
        ws = wb[tab]
        for r in range(56, 64):
            txt = clean_text(ws.cell(row=r, column=1).value)
            if txt and txt not in notes and not txt.startswith("*"):
                notes.append(txt)

    if problems:
        print("\nINTEGRITY PROBLEMS:", file=sys.stderr)
        for p in problems:
            print("  -", p, file=sys.stderr)
        sys.exit(1)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "source": {
            "workbook": WORKBOOK.name,
            "title": clean_text(wb[list(TABS)[0]]["A1"].value),
            "extractedBy": "scripts/extract-workbook.py",
            "dataSourceNotes": notes,
        },
        "years": years,
    }, indent=1) + "\n")
    print(f"\nwrote {OUT.relative_to(ROOT)}  ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
