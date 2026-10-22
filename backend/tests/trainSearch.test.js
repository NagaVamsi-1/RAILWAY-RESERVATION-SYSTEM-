
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/server");

function getFutureDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

describe("BL-07: Train Search API", () => {
  test("returns matching trains for a valid Bengaluru to Chennai search", async () => {
    const response = await request(app)
      .get("/api/trains/search")
      .query({
        source: "Bengaluru",
        destination: "Chennai",
        date: getFutureDate()
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.count, 2);
    assert.equal(response.body.trains.length, 2);
    assert.equal(response.body.trains[0].source, "Bengaluru");
    assert.equal(response.body.trains[0].destination, "Chennai");
    assert.ok(response.body.trains[0].name);
    assert.ok(response.body.trains[0].departure);
    assert.ok(response.body.trains[0].arrival);
    assert.ok(response.body.trains[0].duration);
  });

  test("rejects a request with a missing destination", async () => {
    const response = await request(app)
      .get("/api/trains/search")
      .query({
        source: "Bengaluru",
        date: getFutureDate()
      });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /required/i);
  });

  test("rejects a request with a missing source", async () => {
    const response = await request(app)
      .get("/api/trains/search")
      .query({
        destination: "Chennai",
        date: getFutureDate()
      });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /required/i);
  });

  test("rejects identical source and destination", async () => {
    const response = await request(app)
      .get("/api/trains/search")
      .query({
        source: "Bengaluru",
        destination: "Bengaluru",
        date: getFutureDate()
      });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /different/i);
  });

  test("returns zero results for a route without matching sample trains", async () => {
    const response = await request(app)
      .get("/api/trains/search")
      .query({
        source: "Mumbai",
        destination: "Delhi",
        date: getFutureDate()
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.count, 0);
    assert.deepEqual(response.body.trains, []);
  });

  test("rejects an invalid journey date", async () => {
    const response = await request(app)
      .get("/api/trains/search")
      .query({
        source: "Bengaluru",
        destination: "Chennai",
        date: "not-a-date"
      });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /valid journey date/i);
  });

  test("rejects a journey date in the past", async () => {
    const response = await request(app)
      .get("/api/trains/search")
      .query({
        source: "Bengaluru",
        destination: "Chennai",
        date: "2000-01-01"
      });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /past/i);
  });

  test("search is case-insensitive for station names", async () => {
    const response = await request(app)
      .get("/api/trains/search")
      .query({
        source: "bengaluru",
        destination: "chennai",
        date: getFutureDate()
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.count, 2);
  });
});
