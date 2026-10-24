const crypto = require("node:crypto");

// 10-digit PNR, first digit never 0 (like real PNRs).
function generatePnr() {
  return String(crypto.randomInt(1_000_000_000, 10_000_000_000));
}

function isValidPnrFormat(pnr) {
  return typeof pnr === "string" && /^[1-9]\d{9}$/.test(pnr.trim());
}

module.exports = { generatePnr, isValidPnrFormat };
