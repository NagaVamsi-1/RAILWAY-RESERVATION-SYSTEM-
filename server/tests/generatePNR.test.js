const test = require("node:test");
const assert = require("node:assert/strict");

const generatePNR = require("../utils/generatePNR");

test("PNR should contain exactly 10 digits", () => {
  const pnr = generatePNR();

  assert.match(pnr, /^\d{10}$/);
});

test("PNR should be returned as a string", () => {
  const pnr = generatePNR();

  assert.equal(typeof pnr, "string");
});

test("PNR generator should produce different values across repeated calls", () => {
  const generatedPNRs = new Set();

  for (let i = 0; i < 100; i++) {
    generatedPNRs.add(generatePNR());
  }

  assert.equal(generatedPNRs.size, 100);
});