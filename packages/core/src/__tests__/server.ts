import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  BASE_URL,
  actMetadataFixture,
  actStructFixture,
  unitTextFixtures,
  changedActsFixture,
} from "./fixtures/eli-api.js";

export const handlers = [
  // GET /acts/DU/2017/2196
  http.get(`${BASE_URL}/acts/DU/2017/2196`, () =>
    HttpResponse.json(actMetadataFixture),
  ),

  // GET /acts/DU/2017/2196/struct
  http.get(`${BASE_URL}/acts/DU/2017/2196/struct`, () =>
    HttpResponse.json(actStructFixture),
  ),

  // GET /acts/DU/2017/2196/text.html/{unitPath}
  // Use RegExp handler + request.url slicing to reliably extract multi-segment paths
  // (path-to-regexp wildcard params behave unexpectedly with "=" in segments).
  http.get(
    new RegExp(
      `${BASE_URL.replace(/\./g, "\\.")}/acts/DU/2017/2196/text\\.html/`,
    ),
    ({ request }) => {
      const prefix = `${BASE_URL}/acts/DU/2017/2196/text.html/`;
      const unitPath = request.url.startsWith(prefix)
        ? request.url.slice(prefix.length)
        : "";
      const html = unitTextFixtures[unitPath];
      if (!html) return new HttpResponse(null, { status: 404 });
      return new HttpResponse(html, {
        headers: { "Content-Type": "text/html" },
      });
    },
  ),

  // GET /changes/acts
  http.get(`${BASE_URL}/changes/acts`, () =>
    HttpResponse.json(changedActsFixture),
  ),
];

export const server = setupServer(...handlers);
