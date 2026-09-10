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
