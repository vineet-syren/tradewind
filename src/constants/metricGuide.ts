/**
 * Plain-English explanations behind every chart and KPI in the application.
 *
 * The audience is a stakeholder who did not build this and does not work in
 * freight: a CFO reading a board pack, an auditor checking a disclosure, a
 * customer's sustainability lead. Each entry answers the four questions such a
 * reader actually has, in that order:
 *
 *   what     what am I looking at, in words, with no jargon left undefined
 *   how      how is the number produced — the arithmetic, not a hand-wave
 *   example  one worked example end to end, using real figures
 *   soWhat   what decision or conclusion this supports, and its limits
 *
 * Every number in an `example` is a real value from
 * `Transport Downstream- V02.xlsx`, verified against the generated data — so a
 * reader can follow it into the shipment register and land on the same figure.
 * They are written out longhand on purpose: a stakeholder who can reproduce one
 * calculation by hand will trust the other three hundred.
 */

export interface MetricGuide {
  /** Heading for the panel — usually the chart's own title. */
  title: string;
  what: string;
  how: string;
  /** Steps of one real calculation, each a line. */
  example: string[];
  soWhat: string;
  /** Jargon used on this chart, defined. */
  terms?: { term: string; definition: string }[];
  /** Anything the figure cannot be used for — stated rather than implied. */
  caveat?: string;
}

/** Definitions reused across several charts, so they never drift apart. */
const TERMS = {
  co2e: {
    term: 'CO₂e',
    definition:
      'Carbon dioxide equivalent — every greenhouse gas from a movement expressed as the amount of CO₂ that would cause the same warming, so one number covers them all. Quoted in tonnes (t) or kilograms (kg).',
  },
  intensity: {
    term: 'Intensity (g CO₂e per tonne-kilometre)',
    definition:
      'Grams of CO₂e to move one tonne of goods one kilometre. It is the efficiency measure: unlike a total, it does not rise just because you shipped more, so it is the fair way to compare a heavy year with a light one, or one lane with another.',
  },
  tonneKm: {
    term: 'Tonne-kilometre (t·km)',
    definition:
      'One tonne carried one kilometre. 25 tonnes moved 100 km is 2,500 tonne-kilometres. It is the unit of transport work done, and the denominator of intensity.',
  },
  emissionFactor: {
    term: 'Emission factor',
    definition:
      'The published amount of CO₂e per unit of transport for a mode. These four come from the workbook itself, not from an industry default: road 0.5928 kg per kilometre, rail 0.00996, ocean 0.0084 and air 1.58 kg per tonne-kilometre.',
  },
  perTruckRun: {
    term: 'Charged per truck run',
    definition:
      'Road is billed per kilometre driven, not per tonne carried — a truck emits the same whether it holds 400 kg or 25 tonnes. Every other mode is billed per tonne carried. This single difference is why a part-loaded truck to a distant port can cost more carbon than the ocean voyage after it.',
  },
  gateway: {
    term: 'Gateway',
    definition:
      'The Indian port a shipment leaves through — Nhava Sheva or Chennai in this data. Choosing it fixes both the inland run to reach it and the sailing distance from it.',
  },
  lane: {
    term: 'Lane',
    definition:
      'One destination port carrying one product category, e.g. Laem Chabang · Red Pepper · Ground. It is the level at which a routing decision repeats, so it is the level worth managing.',
  },
  optimisedRoute: {
    term: 'Optimised route',
    definition:
      'The lowest-CO₂e routing available for a shipment, chosen only from routes the workbook records other shipments actually taking. Nothing hypothetical is ever offered, and where nothing beats the booked route, the booked route is the optimised one.',
  },
  avoidable: {
    term: 'Avoidable',
    definition:
      'The CO₂e difference between the route a shipment took and its optimised route. For freight already moved it is hindsight — what the same decision would have saved. For the forward book it is still available.',
  },
  reportingYear: {
    term: 'Reporting year',
    definition:
      'The workbook keeps July-to-June financial years, so FY23-24 means July 2023 to June 2024. Every year figure uses that window, not the calendar year.',
  },
} as const;

/** The one calculation everything else is built from — reused in several guides. */
const WORKED_SHIPMENT: string[] = [
  'Shipment SHP-2122-002 — 24 t of ground chilli, VKS Factory to Antwerp, dispatched 8 Jul 2021. It moves in three legs and each is costed on its own basis:',
  'Road, factory to the Hyderabad depot: 645 km × 0.5928 kg/km ÷ 1,000 = 0.382 t. The 24 t load does not enter this — road is charged per truck run.',
  'Rail, factory to Nhava Sheva: 702 km × 24 t × 0.00996 kg/t·km ÷ 1,000 = 0.168 t.',
  'Ocean, Nhava Sheva to Antwerp: 13,116 km × 24 t × 0.0084 kg/t·km ÷ 1,000 = 2.644 t.',
  'Total = 0.382 + 0.168 + 2.644 = 3.194 t CO₂e for the shipment.',
  'Intensity = 3.194 t × 1,000,000 ÷ (24 t × 14,463 km) = 9.20 g CO₂e per tonne-kilometre.',
];

export const METRIC_GUIDE: Record<string, MetricGuide> = {
  // ── Control Tower ────────────────────────────────────────────────────────
  'network-map': {
    title: 'Outbound shipment network',
    what: 'The physical route each shipment takes out of India — factory, inland depot, gateway port, then the sailing or flight to the destination. Selecting one shipment draws its optimised route alongside the route it was booked on, so the difference is visible as geography rather than as a number.',
    how: 'Each line is drawn from the places the workbook names for that shipment and the distances it records against them. Nothing is inferred from a mapping service: if the sheet says the sailing is 16,735 km, that is the figure used to cost it, whatever the drawn line looks like.',
    example: [
      'A New York shipment leaves VKS Factory, runs 51 km by road to ICD Hyderabad, then 702 km by rail to Nhava Sheva, then sails 16,735 km.',
      'Its CO₂e is 0.030 t + 0.174 t + 3.507 t = 3.71 t, and hovering any leg shows that leg\'s distance, factor and the workbook cell it came from.',
    ],
    soWhat: 'It answers "where does our freight actually go, and what does each stage of that journey cost us?" — and makes clear that the long sailing is usually most of the carbon, while the short inland run is usually the part you can change.',
    terms: [TERMS.gateway, TERMS.optimisedRoute],
  },

  'shipment-register': {
    title: 'Shipment register',
    what: 'Every movement in the dataset, newest first: the historic shipments read from the workbook, and the forward book of shipments still to be planned. One row is one movement, with its own weight, route, CO₂e and optimised route.',
    how: 'Rows come straight from the workbook, one per ocean or air movement plus the first-mile collection runs. CO₂e is the sum of that shipment\'s legs. "Avoidable" is what its optimised route would have saved.',
    example: [
      'Row SHP-2122-002 reads 3.19 t CO₂e and 370 kg avoidable.',
      'The 370 kg is the difference between its 645 km first-mile road run and the 21 km run the workbook records for the same journey on 62 other shipments: (645 − 21) km × 0.5928 kg/km ÷ 1,000 = 0.370 t.',
      'Clicking the row opens that comparison with the workbook cell behind each figure.',
    ],
    soWhat: 'This is the audit trail. Any total anywhere in the application can be traced down to these rows, and each row down to a cell range in the spreadsheet.',
    terms: [TERMS.co2e, TERMS.avoidable, TERMS.optimisedRoute],
  },

  // ── Trend ────────────────────────────────────────────────────────────────
  'year-over-year': {
    title: 'Year over year',
    what: 'Total CO₂e for each reporting year as bars, with transport intensity as a line. Two measures on one chart because they answer different questions: the bars say how much carbon the business emitted, the line says how efficiently it moved each tonne.',
    how: 'Bars: add up the CO₂e of every movement dispatched inside that July-to-June window. Line: the year\'s CO₂e divided by its tonne-kilometres, in grams. A year that has not reached its June year-end is drawn dashed and left out of the trend, because a part year is not comparable with a full one.',
    example: [
      'FY21-22: 245.8 t CO₂e across 114 movements carrying 3,518 t.',
      'FY23-24: 146.6 t across 91 movements carrying 1,336 t.',
      'The total fell 40.4%, but volume fell 62% — so the drop is mostly less freight, not better routing.',
      'Intensity confirms it: 9.25 → 9.53 g/t·km, so each tonne-kilometre actually got slightly worse.',
    ],
    soWhat: 'This is the pairing that stops a good-looking headline being misread. Reporting "emissions down 40%" without the intensity line would credit the business for a fall that came from shipping less, and would hide that efficiency went the wrong way.',
    terms: [TERMS.reportingYear, TERMS.intensity, TERMS.tonneKm],
    caveat: 'A total falling because volume fell is not a decarbonisation result. Intensity is the measure that survives a change in business volume, which is why disclosures ask for it.',
  },

  'month-by-month': {
    title: 'Month by month',
    what: 'One bar per month of CO₂e, with a line showing how much that month moved against the one before it, read on the right-hand axis.',
    how: 'Bars: the CO₂e of every movement dispatched in that month. Line: (this month − last month) ÷ last month, as a percentage. Where a swing runs past the edge of the axis the point is drawn hollow and its true value stays in the tooltip, so one freak month cannot flatten the other thirty-four.',
    example: [
      'A month with two 25 t containers to New York carries roughly 7.4 t of CO₂e.',
      'A month with one carries roughly 3.7 t — a 50% fall, with nothing about the routing having changed.',
      'That is why the percentage line is context, not a performance measure.',
    ],
    soWhat: 'Useful for spotting seasonality and planning capacity — knowing the peak months tells you when consolidating part loads is worth most. It is not useful as a monthly scorecard.',
    caveat: 'Shipments are lumpy: one container landing either side of a month end moves the bar substantially. Read direction over a year, not month to month.',
    terms: [TERMS.co2e],
  },

  'reduction-trend': {
    title: 'Actual against the best proven route',
    what: 'The solid area is the CO₂e actually emitted each month. The dashed line is what the same month would have cost had every shipment taken its optimised route. The gap between them is the avoidable carbon.',
    how: 'For each month, add up what was emitted, then add up what each of those shipments would have emitted on its lowest-CO₂e evidenced routing. The dashed line is the second total.',
    example: [
      'A month with 3.19 t of actual CO₂e where one shipment could have run its 21 km first mile instead of 645 km.',
      'Actual 3.19 t; on the optimised route 2.82 t; the gap on the chart is that 0.37 t.',
    ],
    soWhat: 'It sizes the opportunity honestly and repeatedly — the gap is not a target pulled from the air, it is the arithmetic of routes the business has already run.',
    caveat: 'This is deliberately not a "business as usual" baseline. The workbook contains no counterfactual, so the only honest comparison is against routes it actually records.',
    terms: [TERMS.optimisedRoute, TERMS.avoidable],
  },

  // ── Composition ──────────────────────────────────────────────────────────
  'hotspot-ranking': {
    title: 'CO₂e by dimension',
    what: 'The same total emissions re-cut by whichever dimension you pick — product category, product, destination port, market, gateway or mode — ranked heaviest first. Changing the dimension does not change the total, only how it is divided.',
    how: 'Group every movement in scope by the chosen field and add up its CO₂e. Each bar is one group, and the bars always sum to the total in the KPI above.',
    example: [
      'Sliced by product category, Chilli · Ground is the largest single group.',
      'Re-slice by destination port and the same emissions redistribute across New York, Laem Chabang, Antwerp and the rest — same grand total, different cut.',
    ],
    soWhat: 'It answers "where is our carbon concentrated?" in whichever language the conversation needs — product for a category manager, port for a logistics lead, market for a commercial team.',
    terms: [TERMS.co2e],
  },

  'mode-split': {
    title: 'CO₂e by transport mode',
    what: 'How the footprint divides across ocean, rail, road and air, by the mode that dominates each shipment.',
    how: 'Each shipment is attributed to the mode of its heaviest leg, and those are added up. The percentages are shares of the total CO₂e in scope.',
    example: [
      'Ocean-led shipments carry about 92% of the CO₂e, because the sailing is by far the longest leg.',
      'But per tonne carried, ocean is the cheapest mode in the book at 0.0084 kg per tonne-kilometre.',
      'Air is the reverse: about 1% of the total from a single shipment, at 1.58 kg per tonne-kilometre — 188 times the sea factor.',
    ],
    soWhat: 'Reading it by share alone points at ocean, which is mostly unavoidable if you are exporting from India. Reading it alongside the factors points at the two things you can move: air freight, and the road legs charged per truck run.',
    caveat: 'Judge modes per tonne carried, not per shipment. A flown consignment weighs a fraction of a container, so a shipment count always flatters air.',
    terms: [TERMS.emissionFactor, TERMS.perTruckRun],
  },

  'intensity-ranking': {
    title: 'Least efficient per tonne moved',
    what: 'The same groups ranked by efficiency rather than size — how many grams of CO₂e each one spends moving a tonne of goods a kilometre. Least efficient first.',
    how: 'For each group: total CO₂e in grams, divided by total tonne-kilometres. A dashed marker shows the network average so an outlier is obvious.',
    example: [
      'SHP-2122-002 carries 24 t over 14,463 km for 3.194 t of CO₂e.',
      'Intensity = 3.194 × 1,000,000 ÷ (24 × 14,463) = 9.20 g/t·km — close to the network average.',
      'The single air shipment runs at 3,108 g/t·km, roughly 340 times worse, because it carried 50 kg on a route costed per tonne.',
    ],
    soWhat: 'Large totals get attention; poor intensity is what actually signals a routing problem. A small lane at the top of this list is usually a part-loaded truck or an air shipment, and both are fixable.',
    terms: [TERMS.intensity, TERMS.tonneKm],
  },

  'mode-trend': {
    title: 'Monthly CO₂e by mode',
    what: 'The monthly footprint stacked by transport mode, so seasonal peaks and the mode driving them are visible together.',
    how: 'For each month, add the CO₂e of every leg of each mode. Band height is that mode\'s contribution; total height is the month.',
    example: [
      'A peak month is almost entirely ocean, because containers left that month.',
      'Any month where the road band thickens without the ocean band growing means more truck runs for the same freight — usually part loads that could have shared a truck.',
    ],
    soWhat: 'It shows when to book rail and sea capacity ahead of a peak, and makes the road band — the part a gateway or consolidation decision moves — visible against the ocean band that dwarfs it.',
    terms: [TERMS.co2e],
  },

  'flows-sankey': {
    title: 'Gateway → mode → region',
    what: 'How carbon flows out of India: from each gateway port, through each transport mode, to each destination region. Band thickness is CO₂e.',
    how: 'Every movement contributes its CO₂e to one gateway → mode band and one mode → region band. The bands are the same emissions counted at two stages of the journey, so each stage sums to the same total.',
    example: [
      'The thickest band leaves Nhava Sheva by ocean, because most containers do.',
      'Following it right shows where those tonnes land — Americas, Europe or APAC.',
    ],
    soWhat: 'Gateway choice fixes both the inland run and the sailing distance, so a thick band here is a decision point, not just a description. It is the clearest single view of where a routing change would bite.',
    terms: [TERMS.gateway],
  },

  'collection': {
    title: 'First-mile collection',
    what: 'The road runs bringing raw chilli from the growing regions into the factory and collection stores, kept separate from the export chain.',
    how: 'Each workbook row carries a monthly trip count, and the CO₂e it records already covers all of those trips. They are grouped by growing region.',
    example: [
      'A collection run of 100 km at the road factor costs 100 × 0.5928 ÷ 1,000 = 0.059 t per trip.',
      'The workbook states the CO₂e for the row including its trips, and that figure is used as recorded.',
    ],
    soWhat: 'These movements belong in the reported total — they are real emissions — but no gateway or sailing decision changes them, so they are held apart from the route suggestions rather than inflating what looks addressable.',
    terms: [TERMS.perTruckRun],
  },

  // ── Lanes ────────────────────────────────────────────────────────────────
  'category-treemap': {
    title: 'CO₂e by product category',
    what: 'The footprint as nested rectangles, each sized in proportion to its emissions. Reading area rather than bar length makes the relative weight of the big groups immediate.',
    how: 'Group by the chosen slice, add the CO₂e, and size each rectangle as its share of the total.',
    example: [
      'A category at 203 t inside a 565 t total occupies 36% of the area.',
      'The same 203 t appears as the top bar on the Emission Hotspots ranking — one number, two ways of seeing it.',
    ],
    soWhat: 'Best for a first look with a stakeholder who has not seen the data: it shows concentration at a glance without anyone needing to read an axis.',
    terms: [TERMS.co2e],
  },

  'dest-mode': {
    title: 'Destination × mode',
    what: 'For each destination port, how its CO₂e divides across road, rail, ocean and air.',
    how: 'Split by the leg that produced the emissions, not by the shipment\'s dominant mode — so a container\'s truck run counts as road even though its sailing outweighs it. That is what keeps the road share visible.',
    example: [
      'A New York shipment of 3.71 t splits into 0.030 t road, 0.174 t rail and 3.507 t ocean.',
      'Attributing all 3.71 t to "ocean" because ocean dominates would hide the road leg entirely — and the road leg is the part a routing decision can change.',
    ],
    soWhat: 'The road band is the addressable one. This chart is how you find the markets where it is thickest.',
    terms: [TERMS.perTruckRun],
  },

  'region-mode': {
    title: 'Region × mode',
    what: 'Column width is each destination region\'s share of the footprint; column height is that region\'s mode mix. Two dimensions in one chart.',
    how: 'Width comes from the region\'s total CO₂e as a share of all regions; the internal split from its modes.',
    example: [
      'A wide column with a thin red band is a large region with little air freight.',
      'A narrow column with a thick red band is a small region with an air-freight problem — small in total, but the wrong shape.',
    ],
    soWhat: 'It separates "big" from "badly shaped". The narrow-but-red columns are usually the quickest wins, because a small volume of air freight is easy to move to sea.',
  },

  'lane-priority': {
    title: 'Lane priority',
    what: 'Every lane as a bubble: left-to-right is how much freight it moved, bottom-to-top is how much CO₂e each tonne costs per kilometre, and bubble size is what could be saved by re-routing it.',
    how: 'X is the lane\'s total weight, Y its intensity, and the area is its avoidable CO₂e. Both axes default to a log scale — each gridline is ten times the last — because the lanes differ by three orders of magnitude.',
    example: [
      'A lane moving 1,392 t at 9.8 g/t·km sits far right and low: large but efficient.',
      'A lane moving 9.6 t at 153 g/t·km sits far left and high: tiny, but spending sixteen times as much carbon per tonne-kilometre.',
      'The second is the one to look at, and on a linear scale it would be invisible in the corner.',
    ],
    soWhat: 'It ranks by what is worth doing rather than by what is biggest. High and to the right, or simply a large bubble, is where to start.',
    caveat: 'The log scale spreads the cluster so it can be read; it changes the spacing, never a value. Switch to Linear for true proportional distance.',
    terms: [TERMS.lane, TERMS.intensity, TERMS.avoidable],
  },

  'lane-table': {
    title: 'All lanes',
    what: 'Every lane with its gateways, the modes it uses, how many shipments it has run, its weight, CO₂e, intensity and what is recoverable.',
    how: 'Each row aggregates that lane\'s shipments. The Modes column lists every mode the lane has used in travel order, not just the dominant one.',
    example: [
      'A lane reading "Road › Rail › Ocean" with two gateways has shipped both ways already.',
      'That makes a gateway swap on it a choice the business has demonstrably made before, not a proposal.',
    ],
    soWhat: 'The working list. Sort by Avoidable to rank by opportunity, or by g/t·km to find the inefficient lanes regardless of size.',
    terms: [TERMS.lane, TERMS.gateway, TERMS.avoidable],
  },

  // ── Route options ────────────────────────────────────────────────────────
  'route-options': {
    title: 'Route optimisation',
    what: 'The route a shipment was booked on, beside every cheaper routing the workbook proves was available. One card per lever, with the lowest-CO₂e one marked as the optimised route.',
    how: 'Each option is re-costed on this shipment\'s own weight and distances using the workbook\'s factors, and is only offered when every leg it needs appears in the sheet. Five levers exist: shorter first mile, shorter sailing, different gateway, sea instead of air, and sharing a truck.',
    example: [
      'SHP-2122-002 as booked: 645 km road + 702 km rail + 13,116 km ocean = 3.194 t.',
      'Shorter first mile: the same rail and sailing, but the 21 km road run the workbook records for that journey on 62 other shipments.',
      'Road becomes 21 × 0.5928 ÷ 1,000 = 0.012 t instead of 0.382 t. Total 2.824 t.',
      'Saving 0.370 t, or 12%, with no change to the sailing at all.',
    ],
    soWhat: 'Every option is a route the business has already run, so the conversation is about repeating a past decision rather than trusting a model. Booking still happens in your own systems.',
    caveat: 'Freight cost and service commitments are not in the workbook, so options are ranked on CO₂e with transit shown beside them as a guardrail. A slower route may be unacceptable for reasons this data cannot see.',
    terms: [TERMS.optimisedRoute, TERMS.emissionFactor, TERMS.perTruckRun],
  },

  // ── Report ───────────────────────────────────────────────────────────────
  reconciliation: {
    title: 'Reconciliation to the workbook',
    what: 'The audit trail from the total the workbook prints for each tab to the total this application reports, with every adjustment itemised.',
    how: 'Start at cell D53 of the tab, apply each adjustment, arrive at the reported figure. The bridge is checked when the data is built — if it ever stopped adding up, the build would fail rather than publish an untraceable number.',
    example: [
      'FY21-22 prints 218.693 t in cell D53.',
      'Add 29.836 t of export road legs the tab marks "handled by external SP" and leaves out of its own total.',
      'Subtract 2.701 t where the collection block lists some of those same runs a second time.',
      '218.693 + 29.836 − 2.701 = 245.828 t, which is what is reported.',
    ],
    soWhat: 'This is what makes the number defensible in an audit. The difference is one of scope — which movements are counted — not of calculation, and every line can be checked against a cell.',
    caveat: 'FY23-24 needs no adjustment and ties exactly. The two earlier years differ only because of how the tab itself chose to present its total.',
  },

  'bridge-waterfall': {
    title: 'How a year bridges to the reported total',
    what: 'The same reconciliation read left to right: the printed workbook total, each adjustment as a step up or down, and the reported figure.',
    how: 'Identical arithmetic to the table above, drawn so the size of each adjustment is visible against the total.',
    example: [
      'A tall first bar at 218.693 t, a step up of 29.836 t, a small step down of 2.701 t, and a final bar at 245.828 t.',
    ],
    soWhat: 'Shows at a glance whether a bridge is a rounding matter or a material one. Here the omitted road legs are 14% of the printed total, which is material and worth a sentence in any disclosure.',
  },

  'year-detail': {
    title: 'Reporting year in detail',
    what: 'One recorded year split four ways — by product category, destination port, gateway port and transport mode. The same emissions, cut four different ways.',
    how: 'Group that year\'s movements by each field and total the CO₂e. Every one of the four splits sums back to the year total and to 100%.',
    example: [
      'FY23-24 totals 146.6 t across 91 movements.',
      'Whether that is divided by category, port, gateway or mode, the parts add back to 146.6 t — because they are the same movements counted a different way, not four separate measurements.',
    ],
    soWhat: 'This is the table that goes into a disclosure or a customer questionnaire. The four cuts cover almost every way a reader will ask for the number to be broken down.',
    terms: [TERMS.reportingYear],
  },

  'emission-factors': {
    title: 'Emission factors',
    what: 'The four numbers that turn kilometres into carbon, exactly as the workbook states them, with the basis each is charged on.',
    how: 'Every CO₂e figure anywhere in the application is a distance multiplied by one of these, and by the weight for every mode except road.',
    example: [
      'Road: a truck driving 100 km emits 100 × 0.5928 = 59.3 kg whether it carries 400 kg or 25 tonnes.',
      'Rail: 25 t moved 700 km costs 25 × 700 × 0.00996 ÷ 1,000 = 0.174 t.',
      'The same 700 km by truck costs 0.415 t regardless of load — nearly two and a half times as much for a full container, and far more for a part load.',
    ],
    soWhat: 'The Charged column matters more than the factor. Road being billed per run rather than per tonne is the single fact that makes gateway choice and truck sharing worth real tonnes.',
    terms: [TERMS.emissionFactor, TERMS.perTruckRun, TERMS.tonneKm],
  },

  'data-issues': {
    title: 'Rows to fix in the source workbook',
    what: 'Places where the spreadsheet contradicts itself, found while rebuilding the shipments from it. Not calculation errors in this application — errors in the source, surfaced rather than quietly resolved.',
    how: 'While attributing legs to shipments, any row that disagrees with another row describing the same movement is flagged with both figures and its cell range.',
    example: [
      'The factory-to-depot run is recorded at 645 km on 69 FY21-22 rows and at 21 km on 62 rows either side of it.',
      'Hyderabad is where the factory is, so 645 km cannot be right.',
      'At the road factor that one distance is worth 0.37 t per shipment — about 26 t across the affected rows.',
    ],
    soWhat: 'The highest-value correction available, and it costs nothing but a spreadsheet edit. Nothing here has been auto-corrected: the application reports what the sheet says and shows you where the sheet is inconsistent.',
  },
};

/**
 * KPI tiles carry the same treatment, keyed by the tile's own id.
 *
 * Some pages spell the same metric differently — `co2e` and `total` are both the
 * scoped footprint, `avoid` and `avoidable` both the recoverable figure — so the
 * aliases at the end of this object make sure a tile never renders without its
 * explanation just because a page picked the other name.
 */
export const KPI_GUIDE: Record<string, MetricGuide> = {
  total: {
    title: 'CO₂e in scope',
    what: 'Total carbon emitted by every movement matching the current filters.',
    how: 'Add up the CO₂e of every leg of every movement in scope. With no date filter set, scope is everything already shipped — the forward book is excluded so historical analytics never absorb freight that has not moved.',
    example: [
      'Unfiltered, this reads 565 t across 290 movements — the whole workbook, July 2021 to June 2024.',
      'That is the sum of FY21-22 (245.8 t), FY22-23 (172.2 t) and FY23-24 (146.6 t).',
    ],
    soWhat: 'The reported Scope 3 Category 9 figure for downstream transport. It is the number that goes in the disclosure.',
    terms: [TERMS.co2e],
  },
  avoidable: {
    title: 'Avoidable on optimised routes',
    what: 'How much of the CO₂e in scope could have been avoided by taking routes the workbook itself records.',
    how: 'For each shipment, the difference between what it emitted and what its optimised route would have emitted, added up.',
    example: [
      'Across the whole workbook this is 50.2 t of 565 t, or 8.9%.',
      'The largest component is 21.1 t from running the shorter first mile the sheet records elsewhere.',
    ],
    soWhat: 'A ceiling on what better routing alone could deliver, evidenced rather than modelled. It deliberately excludes anything requiring a new carrier, lane or technology.',
    caveat: 'For freight already shipped this is hindsight. Only the forward book portion is still actionable.',
    terms: [TERMS.avoidable, TERMS.optimisedRoute],
  },
  road: {
    title: 'Road legs',
    what: 'CO₂e from the road legs alone — the truck runs between factory, depot and port.',
    how: 'Add the CO₂e of every road leg across all movements in scope, whatever mode dominated the shipment overall.',
    example: [
      'A 645 km run costs 645 × 0.5928 ÷ 1,000 = 0.382 t, whether the truck carries 400 kg or 25 t.',
      'Across the workbook, road legs total 77.0 t of the 565 t.',
    ],
    soWhat: 'Only about 14% of the footprint, but the part most within reach: it is charged per truck run, so a shorter run or a shared truck converts directly into tonnes saved.',
    terms: [TERMS.perTruckRun],
  },
  intensity: {
    title: 'Intensity',
    what: 'Grams of CO₂e to move one tonne of goods one kilometre — the efficiency of the network, independent of how much was shipped.',
    how: 'Total CO₂e in grams, divided by total tonne-kilometres (each shipment\'s weight × its distance).',
    example: WORKED_SHIPMENT,
    soWhat: 'The figure that belongs in a disclosure alongside the total, because it holds when business volume changes. A total that falls because you shipped less is not an efficiency gain; intensity is what shows whether routing actually improved.',
    terms: [TERMS.intensity, TERMS.tonneKm],
  },
  weight: {
    title: 'Freight moved',
    what: 'Total product weight shipped across the movements in scope.',
    how: 'Add the quantity recorded against each movement, converted from kilograms to tonnes.',
    example: ['FY21-22 moved 3,518 t; FY23-24 moved 1,336 t — a 62% fall in volume.'],
    soWhat: 'The denominator behind intensity, and the context for any change in the total. Read it before concluding anything from a change in emissions.',
  },
  conc: {
    title: 'Top-3 port share',
    what: 'How much of the footprint the three largest destination ports account for.',
    how: 'Add the CO₂e shares of the top three destination ports.',
    example: ['A 90% reading means three ports carry nine tenths of the carbon, and the remaining ports share a tenth between them.'],
    soWhat: 'High concentration is good news operationally: a change on three lanes moves most of the number, so effort goes a long way.',
  },
  latest: {
    title: 'CO₂e for the selected reporting year',
    what: 'The reported total for whichever reporting year is selected above, or for all recorded years together.',
    how: 'Add the CO₂e of every movement dispatched inside that July-to-June window. Recorded years only — no synthetic row is ever included on this page.',
    example: [
      'FY23-24: 146.6 t across 91 movements, 1 Jul 2023 to 30 Jun 2024.',
      'This is the figure the reconciliation below ties back to cell D53 of the workbook tab.',
    ],
    soWhat: 'The headline disclosure number for the year, with a full audit trail underneath it.',
    terms: [TERMS.reportingYear],
  },
  change: {
    title: 'Change against the previous year',
    what: 'How the selected year\'s total compares with the year before it.',
    how: '(this year − previous year) ÷ previous year, as a percentage. Negative is a reduction.',
    example: ['FY23-24 at 146.6 t against FY22-23 at 172.2 t is a 14.8% reduction.'],
    soWhat: 'The year-on-year line in a report. Always pair it with intensity and volume: a fall driven by shipping less is not a decarbonisation result.',
    caveat: 'Volume fell 62% across these three years, so most of the reduction in the total is lower activity rather than better routing.',
    terms: [TERMS.reportingYear],
  },
};

// Aliases — the same metric under the id a given page happens to use.
KPI_GUIDE.co2e = KPI_GUIDE.total;
KPI_GUIDE.avoid = KPI_GUIDE.avoidable;
