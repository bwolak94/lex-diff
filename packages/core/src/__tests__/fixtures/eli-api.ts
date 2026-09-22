// MSW fixture data for ELI API endpoints.
// Act: DU/2017/2196 — fictional structure for testing.

export const ACT_ELI = "DU/2017/2196";
export const BASE_URL = "https://api.sejm.gov.pl/eli";

export const actMetadataFixture = {
  ELI: ACT_ELI,
  publisher: "DU",
  year: 2017,
  pos: 2196,
  title: "Ustawa z dnia 14 marca 2017 r. o testach jednostkowych",
  type: "Ustawa",
  status: "obowiązujący",
  inForce: true,
  announcementDate: "2017-11-24",
  entryIntoForce: "2018-01-01",
  repealDate: null,
  changeDate: "2024-06-15",
  textHTML: true,
  keywords: ["testy", "prawo cywilne"],
  texts: [{ kind: "PDF", url: "https://example.com/doc.pdf", type: "tekst ogłoszony" }],
};

export const actMetadataNoTextFixture = {
  ...actMetadataFixture,
  textHTML: false,
};

// The real ELI API returns a bare array of struct nodes (not wrapped in an object)
export const actStructFixture = [
  {
    type: "art",
    num: "1",
    children: [
      { type: "ustep", num: "1", children: [] },
      { type: "ustep", num: "2", children: [] },
    ],
  },
  {
    type: "art",
    num: "2",
    children: [
      { type: "punkt", num: "1", children: [] },
      { type: "punkt", num: "2", children: [] },
    ],
  },
  { type: "art", num: "3", children: [] },
];

export const unitTextFixtures: Record<string, string> = {
  "art=1/ustep=1": "<p>Ustawa reguluje zasady testowania oprogramowania.</p>",
  "art=1/ustep=2": "<p>Przepisy ustawy stosuje się do&nbsp;wszystkich podmiotów.</p>",
  "art=2/punkt=1": "<p>Dz.&#160;U. z 2024&#160;r. poz. 1401 — przepis zmieniony.</p>",
  "art=2/punkt=2": "<p>Każdy test jednostkowy musi być niezależny.</p>",
  "art=3": "<p>Ustawa wchodzi w życie z dniem 1 stycznia 2018&#160;r.</p>",
};

export const changedActsFixture = {
  offset: 0,
  limit: 100,
  count: 1,
  items: [
    {
      ELI: ACT_ELI,
      publisher: "DU",
      year: 2017,
      pos: 2196,
      changeDate: "2024-06-15T10:00:00Z",
    },
  ],
};

// S6-10: Contract fixtures — edge-case API response shapes

/** Act with inForce / textHTML sent as strings ("True") instead of booleans */
export const actMetadataStringBoolFixture = {
  ELI: ACT_ELI,
  publisher: "DU",
  year: 2017,
  pos: 2196,
  title: "Ustawa z dnia 14 marca 2017 r. o testach jednostkowych",
  type: "Ustawa",
  status: "obowiązujący",
  inForce: "True",        // API sometimes returns a string
  textHTML: "True",       // same
  keywords: ["testy"],
  texts: [],
};

/** Act with inForce as "IN_FORCE" (another real API variant) */
export const actMetadataInForceStringFixture = {
  ...actMetadataStringBoolFixture,
  inForce: "IN_FORCE",
};

/** Act from M.P. (Monitor Polski) publisher */
export const ACT_MP_ELI = "MP/2023/512";
export const actMpFixture = {
  ELI: ACT_MP_ELI,
  publisher: "MP",
  year: 2023,
  pos: 512,
  title: "Obwieszczenie Marszałka Sejmu z dnia 15 marca 2023 r.",
  type: "Obwieszczenie",
  status: "obowiązujący",
  inForce: true,
  textHTML: false,
  keywords: [],
  texts: [],
};

/** Struct nodes using `name` field instead of `num` (older ELI API variant) */
export const actStructWithNameFixture = [
  {
    type: "art",
    name: "1",          // `name` instead of `num`
    children: [
      { type: "ustep", name: "1", children: [] },
    ],
  },
  {
    type: "art",
    name: "2",
    children: [],
  },
];

/** Search results fixture (for EliClient.searchActs) */
export const searchResultsFixture = {
  count: 1,
  offset: 0,
  totalCount: 1,
  items: [actMetadataFixture],
};
