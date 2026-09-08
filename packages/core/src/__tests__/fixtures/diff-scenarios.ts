import { createHash } from "node:crypto";
import type { Unit, UnitKind } from "../../types.js";
import type { DiffOptions } from "../../diffEngine.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const h = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

function makeUnit(path: string, text: string | null = null): Unit {
  const segments = path.split("/");
  const last = segments.at(-1)!;
  const eq = last.indexOf("=");
  const kind = last.slice(0, eq) as UnitKind;
  const number = last.slice(eq + 1);
  const parentPath = segments.length > 1 ? segments.slice(0, -1).join("/") : null;
  return {
    path,
    kind,
    number,
    numberSort: number.replace(/^(\d+)/, (m) => m.padStart(10, "0")),
    parentPath,
    text,
    textHash: text !== null ? h(text) : null,
  };
}

const BASE_OPTIONS: DiffOptions = {
  actEli: "DU/2017/2196",
  effectiveDate: "2024-06-15",
  isConsolidated: false,
};

// ── 10 Golden Scenarios ───────────────────────────────────────────────────────

/** S1: Empty → empty — no events */
export const scenario01 = {
  name: "empty arrays",
  old: [] as Unit[],
  new: [] as Unit[],
  options: BASE_OPTIONS,
};

/** S2: Identical act — no events */
export const scenario02 = {
  name: "identical acts — no changes",
  old: [
    makeUnit("art=1", "The act regulates software testing."),
    makeUnit("art=1/ustep=1", "All entities must comply."),
    makeUnit("art=1/ustep=2", "Exceptions may apply."),
    makeUnit("art=2", "Entry into force on 1 January 2018."),
    makeUnit("art=2/ustep=1", "Provisions take effect immediately."),
    makeUnit("art=3", "This act supersedes previous regulations."),
    makeUnit("art=3/ustep=1", "Prior acts are hereby repealed."),
    makeUnit("art=4", "Final provisions."),
    makeUnit("art=5", "Transitional rules apply for six months."),
    makeUnit("art=6", "The minister shall issue implementing regulations."),
  ],
  new: [] as Unit[],
  options: BASE_OPTIONS,
};
// Point new to the same units
scenario02.new = scenario02.old.map((u) => ({ ...u }));

/** S3: One article added */
export const scenario03 = {
  name: "one article added",
  old: [
    makeUnit("art=1", "The act regulates software testing."),
    makeUnit("art=2", "Definitions."),
    makeUnit("art=3", "Final provisions."),
    makeUnit("art=4", "Entry into force."),
    makeUnit("art=5", "Repealing clause."),
    makeUnit("art=6", "Transitional measures."),
    makeUnit("art=7", "Implementing powers."),
    makeUnit("art=8", "Effective date."),
    makeUnit("art=9", "Scope of application."),
    makeUnit("art=10", "Penalties."),
  ],
  new: [] as Unit[],
  options: BASE_OPTIONS,
};
scenario03.new = [
  ...scenario03.old.map((u) => ({ ...u })),
  makeUnit("art=11", "New article: enhanced compliance requirements."),
];

/** S4: One article repealed */
export const scenario04 = {
  name: "one article repealed",
  old: [
    makeUnit("art=1", "The act regulates software testing."),
    makeUnit("art=2", "Definitions."),
    makeUnit("art=3", "Final provisions."),
    makeUnit("art=4", "Entry into force."),
    makeUnit("art=5", "Repealing clause."),
    makeUnit("art=6", "Transitional measures."),
    makeUnit("art=7", "Implementing powers."),
    makeUnit("art=8", "Effective date."),
    makeUnit("art=9", "Scope of application."),
    makeUnit("art=10", "Penalties."),
  ],
  new: [] as Unit[],
  options: BASE_OPTIONS,
};
scenario04.new = scenario04.old
  .filter((u) => u.path !== "art=10")
  .map((u) => ({ ...u }));

/** S5: Three articles amended */
export const scenario05 = {
  name: "three articles amended",
  old: [
    makeUnit("art=1", "The act regulates software testing."),
    makeUnit("art=2", "Definitions are provided here."),
    makeUnit("art=3", "Final provisions apply."),
    makeUnit("art=4", "Entry into force on 1 January 2018."),
    makeUnit("art=5", "Repealing clause is contained here."),
    makeUnit("art=6", "Transitional measures last six months."),
    makeUnit("art=7", "Implementing powers granted to the minister."),
    makeUnit("art=8", "Effective date is announced."),
    makeUnit("art=9", "Scope of application is general."),
    makeUnit("art=10", "Penalties are specified below."),
  ],
  new: [] as Unit[],
  options: BASE_OPTIONS,
};
scenario05.new = scenario05.old.map((u) => {
  if (u.path === "art=2") return makeUnit("art=2", "Updated definitions are provided here as amended.");
  if (u.path === "art=5") return makeUnit("art=5", "Repealing clause has been substantially modified by this amendment.");
  if (u.path === "art=9") return makeUnit("art=9", "Scope of application is limited to public entities only.");
  return { ...u };
});

/** S6: One article renumbered (path changed, text nearly identical) */
export const scenario06 = {
  name: "one article renumbered",
  old: [
    makeUnit("art=1", "The act regulates software testing."),
    makeUnit("art=2", "Definitions are provided in this section of the act."),
    makeUnit("art=3", "Final provisions apply to all entities."),
    makeUnit("art=4", "Entry into force on 1 January 2018."),
    makeUnit("art=5", "Transitional measures last six months."),
    makeUnit("art=6", "Implementing powers granted to the minister."),
    makeUnit("art=7", "Effective date is publicly announced."),
    makeUnit("art=8", "Scope of application is general."),
    makeUnit("art=9", "Penalties are specified below in detail."),
    makeUnit("art=10", "Final clause regarding compliance."),
  ],
  new: [] as Unit[],
  options: BASE_OPTIONS,
};
// art=2 is renumbered to art=2a (text remains very similar — high similarity)
scenario06.new = [
  makeUnit("art=1", "The act regulates software testing."),
  makeUnit("art=2a", "Definitions are provided in this section of the act."),
  makeUnit("art=3", "Final provisions apply to all entities."),
  makeUnit("art=4", "Entry into force on 1 January 2018."),
  makeUnit("art=5", "Transitional measures last six months."),
  makeUnit("art=6", "Implementing powers granted to the minister."),
  makeUnit("art=7", "Effective date is publicly announced."),
  makeUnit("art=8", "Scope of application is general."),
  makeUnit("art=9", "Penalties are specified below in detail."),
  makeUnit("art=10", "Final clause regarding compliance."),
];

/** S7: Mixed: add + repeal + amend */
export const scenario07 = {
  name: "mixed add, repeal, amend",
  old: [
    makeUnit("art=1", "The act regulates software testing and quality assurance."),
    makeUnit("art=2", "All entities must comply with the provisions of this act."),
    makeUnit("art=3", "Exceptions may apply in justified cases."),
    makeUnit("art=4", "Entry into force on 1 January 2018."),
    makeUnit("art=5", "Repealing clause for prior legislation."),
    makeUnit("art=6", "Transitional measures apply for six calendar months."),
    makeUnit("art=7", "Implementing powers granted to the competent minister."),
    makeUnit("art=8", "Scope of application is general."),
    makeUnit("art=9", "Penalties and sanctions are specified."),
    makeUnit("art=10", "Final compliance verification clause."),
  ],
  new: [] as Unit[],
  options: BASE_OPTIONS,
};
scenario07.new = [
  makeUnit("art=1", "The act regulates software testing and quality assurance."),
  makeUnit("art=2", "All entities must comply with the provisions of this act."),
  // art=3 repealed
  makeUnit("art=4", "Entry into force on 1 January 2018, as amended."), // amended
  makeUnit("art=5", "Repealing clause for prior legislation."),
  makeUnit("art=6", "Transitional measures apply for six calendar months."),
  makeUnit("art=7", "Implementing powers granted to the competent minister."),
  makeUnit("art=8", "Scope of application is general."),
  makeUnit("art=9", "Penalties and sanctions are specified."),
  makeUnit("art=10", "Final compliance verification clause."),
  makeUnit("art=11", "New article: enhanced enforcement mechanisms introduced."), // added
];

/** S8: ActConsolidated — isConsolidated flag, no unit matching */
export const scenario08 = {
  name: "consolidated text (jednolity tekst)",
  old: [
    makeUnit("art=1", "Original text of article 1."),
    makeUnit("art=2", "Original text of article 2."),
    makeUnit("art=3", "Original text of article 3."),
    makeUnit("art=4", "Original text of article 4."),
    makeUnit("art=5", "Original text of article 5."),
    makeUnit("art=6", "Original text of article 6."),
    makeUnit("art=7", "Original text of article 7."),
    makeUnit("art=8", "Original text of article 8."),
    makeUnit("art=9", "Original text of article 9."),
    makeUnit("art=10", "Original text of article 10."),
  ],
  new: [] as Unit[],
  options: {
    ...BASE_OPTIONS,
    isConsolidated: true,
    consolidatedEli: "DU/2024/100",
  },
};
scenario08.new = scenario08.old.map((u) => ({
  ...u,
  text: `Consolidated: ${u.text}`,
  textHash: h(`Consolidated: ${u.text!}`),
}));

/** S9: Nested path changes (ustep level amendment) */
export const scenario09 = {
  name: "nested path amendments",
  old: [
    makeUnit("art=1", null),
    makeUnit("art=1/ustep=1", "The ministry shall establish implementing regulations."),
    makeUnit("art=1/ustep=2", "Regulations shall enter into force within ninety days."),
    makeUnit("art=2", null),
    makeUnit("art=2/ustep=1", "Penalties for non-compliance range from 100 to 10000 PLN."),
    makeUnit("art=2/ustep=2", "Repeat offenders face doubled penalties."),
    makeUnit("art=3", null),
    makeUnit("art=3/ustep=1", "Final provisions supersede all prior acts."),
  ],
  new: [] as Unit[],
  options: BASE_OPTIONS,
};
scenario09.new = [
  makeUnit("art=1", null),
  makeUnit("art=1/ustep=1", "The ministry shall establish implementing regulations."),
  makeUnit("art=1/ustep=2", "Regulations shall enter into force within sixty days."), // amended: 90→60
  makeUnit("art=2", null),
  makeUnit("art=2/ustep=1", "Penalties for non-compliance range from 500 to 50000 PLN."), // amended
  makeUnit("art=2/ustep=2", "Repeat offenders face doubled penalties."),
  makeUnit("art=3", null),
  makeUnit("art=3/ustep=1", "Final provisions supersede all prior acts."),
];

/** S10: Complex — renumbering + amendment + addition at multiple levels */
export const scenario10 = {
  name: "complex: renumber + amend + add",
  old: [
    makeUnit("art=1", "Scope of the act."),
    makeUnit("art=1/ustep=1", "This act applies to all software entities in Poland."),
    makeUnit("art=1/ustep=2", "Public institutions are explicitly included."),
    makeUnit("art=2", "Definitions used throughout this act."),
    makeUnit("art=2/punkt=1", "Software means any digital programme or application."),
    makeUnit("art=2/punkt=2", "Entity means any legal or natural person."),
    makeUnit("art=3", "Obligations of software providers."),
    makeUnit("art=3/ustep=1", "Providers must register within 30 days of commencing operations."),
    makeUnit("art=4", "Supervision and enforcement by the competent authority."),
    makeUnit("art=4/ustep=1", "The authority shall conduct annual inspections."),
    makeUnit("art=5", "Penalties for violations."),
    makeUnit("art=5/ustep=1", "Fines range from 1000 to 100000 PLN."),
    makeUnit("art=6", "Transitional provisions."),
    makeUnit("art=7", "Entry into force."),
    makeUnit("art=8", "Repealing clause."),
  ],
  new: [] as Unit[],
  options: BASE_OPTIONS,
};
scenario10.new = [
  makeUnit("art=1", "Scope of the act."),
  makeUnit("art=1/ustep=1", "This act applies to all software entities in Poland."),
  makeUnit("art=1/ustep=2", "Public and private institutions are explicitly included."), // amended
  makeUnit("art=2", "Definitions used throughout this act."),
  makeUnit("art=2/punkt=1", "Software means any digital programme or application."),
  makeUnit("art=2/punkt=2", "Entity means any legal or natural person."),
  makeUnit("art=2/punkt=3", "Provider means any entity supplying software services."), // added
  makeUnit("art=3", "Obligations of software providers."),
  makeUnit("art=3/ustep=1", "Providers must register within 14 days of commencing operations."), // amended: 30→14
  // art=4 renumbered to art=4a (same text)
  makeUnit("art=4a", "Supervision and enforcement by the competent authority."),
  makeUnit("art=4a/ustep=1", "The authority shall conduct annual inspections."),
  makeUnit("art=5", "Penalties for violations."),
  makeUnit("art=5/ustep=1", "Fines range from 5000 to 500000 PLN."), // amended
  makeUnit("art=6", "Transitional provisions."),
  // art=7 repealed
  makeUnit("art=8", "Repealing clause."),
];

export const ALL_SCENARIOS = [
  scenario01,
  scenario02,
  scenario03,
  scenario04,
  scenario05,
  scenario06,
  scenario07,
  scenario08,
  scenario09,
  scenario10,
];
