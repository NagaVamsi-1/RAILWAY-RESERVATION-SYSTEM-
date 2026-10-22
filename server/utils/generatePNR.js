const crypto = require("node:crypto");

function generatePNR() {
  return crypto.randomInt(1000000000, 10000000000).toString();
}

module.exports = generatePNR;