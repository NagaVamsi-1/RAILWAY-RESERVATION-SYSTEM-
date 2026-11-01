// BL-15: language selection (UC-08, FR-08, NFR-04, TC_09).
const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const app = require("../src/server");
const User = require("../src/models/User");
const {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
} = require("../src/config/languages");

describe("BL-15: supported languages (no database needed)", () => {
  test("English, Hindi, Kannada and Tamil are supported", () => {
    assert.deepEqual(
      SUPPORTED_LANGUAGES.map((language) => language.code),
      ["en", "hi", "kn", "ta"]
    );
    assert.equal(DEFAULT_LANGUAGE, "en");
  });

  test("isSupportedLanguage accepts supported codes in any case and rejects everything else", () => {
    for (const code of ["en", "hi", "kn", "ta", "HI", " kn "]) {
      assert.equal(isSupportedLanguage(code), true, code);
    }
    for (const code of ["fr", "mr", "", "english", "en-IN", null, undefined, 5, {}]) {
      assert.equal(isSupportedLanguage(code), false, String(code));
    }
  });

  test("GET /api/languages lists the supported languages and the default", async () => {
    const res = await request(app).get("/api/languages");
    assert.equal(res.status, 200);
    assert.equal(res.body.defaultLanguage, "en");
    assert.deepEqual(
      res.body.languages.map((language) => language.code),
      ["en", "hi", "kn", "ta"]
    );
    assert.ok(res.body.languages.every((language) => language.name && language.nativeName));
  });

  test("saving a language needs a login", async () => {
    const res = await request(app).put("/api/users/me/language").send({ language: "hi" });
    assert.equal(res.status, 401);
  });

  test("an unsupported or missing language is rejected before anything is saved", async () => {
    const token = jwt.sign({ userId: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET);

    const unsupported = await request(app)
      .put("/api/users/me/language")
      .set("Authorization", `Bearer ${token}`)
      .send({ language: "fr" });
    assert.equal(unsupported.status, 400);
    assert.match(unsupported.body.message, /not supported/i);
    assert.equal(unsupported.body.supportedLanguages.length, 4);

    const missing = await request(app)
      .put("/api/users/me/language")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    assert.equal(missing.status, 400);
  });
});

// The saved preference needs a database.
const TEST_URI = process.env.MONGODB_TEST_URI;
const skip = TEST_URI ? false : "Set MONGODB_TEST_URI to run integration tests";

describe("BL-15: saved language preference", { skip }, () => {
  let token;
  let userId;

  before(() => mongoose.connect(TEST_URI));
  after(() => mongoose.disconnect());

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await User.create({
      name: "Ravi Kumar",
      email: "ravi@example.com",
      password: "not-used-here",
    });
    userId = user._id.toString();
    token = jwt.sign({ userId }, process.env.JWT_SECRET);
  });

  const put = (language) =>
    request(app).put("/api/users/me/language").set("Authorization", `Bearer ${token}`).send({ language });
  const get = () =>
    request(app).get("/api/users/me/language").set("Authorization", `Bearer ${token}`);

  test("a passenger starts on the default language", async () => {
    const res = await get();
    assert.equal(res.status, 200);
    assert.equal(res.body.language, "en");
    assert.equal(res.body.isDefault, true);
  });

  test("a supported language is saved and returned (TC_09 valid)", async () => {
    const res = await put("hi");
    assert.equal(res.status, 200);
    assert.equal(res.body.language, "hi");
    assert.equal((await User.findById(userId)).preferredLanguage, "hi");
    assert.equal((await get()).body.language, "hi");
  });

  test("language codes are not case sensitive", async () => {
    assert.equal((await put("KN")).body.language, "kn");
  });

  test("an unsupported language is not applied and the saved one is unchanged (TC_09 invalid)", async () => {
    await put("ta");
    const res = await put("fr");
    assert.equal(res.status, 400);
    assert.match(res.body.message, /not supported/i);
    assert.equal((await User.findById(userId)).preferredLanguage, "ta");
  });
});
