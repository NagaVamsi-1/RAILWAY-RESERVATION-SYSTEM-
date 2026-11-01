
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authenticateToken = require("../middleware/auth");
const {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
} = require("../config/languages");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || normalizedName.length > 100) {
      return res.status(400).json({
        message: "Name must be between 1 and 100 characters.",
      });
    }

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        message: "Password must be between 8 and 72 characters.",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Registration successful.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("User registration failed:", error.message);

    return res.status(500).json({
      message: "Unable to register user.",
    });
  }
});
// BL-05: User login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Password is excluded by default in the User model, so select it explicitly.
    const user = await User.findOne({ email: normalizedEmail })
      .select("+password");

    // Use the same error for unknown email and incorrect password.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");
      return res.status(500).json({
        message: "Login is temporarily unavailable.",
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        // BL-15: null until the passenger has chosen a language.
        preferredLanguage: user.preferredLanguage || null,
      },
    });
  } catch (error) {
    console.error("User login failed:", error.message);

    return res.status(500).json({
      message: "Unable to log in.",
    });
  }
});

// ---------------------------------------------------------------------------
// BL-15: Language selection (UC-08, FR-08, NFR-04)
// ---------------------------------------------------------------------------

// GET /api/users/me/language: the signed-in passenger's saved language.
router.get("/me/language", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({
      language: user.preferredLanguage || DEFAULT_LANGUAGE,
      isDefault: !user.preferredLanguage,
    });
  } catch (error) {
    console.error("Language lookup failed:", error.message);
    return res.status(500).json({ message: "Unable to retrieve your language." });
  }
});

// PUT /api/users/me/language: save the passenger's language.
// UC-08 alternate flow: an unsupported language is not applied and a message explains why.
router.put("/me/language", authenticateToken, async (req, res) => {
  const { language } = req.body || {};

  if (typeof language !== "string" || !language.trim()) {
    return res.status(400).json({ message: "Please choose a language." });
  }

  const code = language.trim().toLowerCase();

  if (!isSupportedLanguage(code)) {
    return res.status(400).json({
      message: `That language is not supported. Please choose one of: ${SUPPORTED_LANGUAGES.map(
        (item) => item.name
      ).join(", ")}.`,
      supportedLanguages: SUPPORTED_LANGUAGES,
    });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { preferredLanguage: code },
      { new: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({
      message: "Language updated.",
      language: user.preferredLanguage,
    });
  } catch (error) {
    console.error("Language update failed:", error.message);
    return res.status(500).json({ message: "Unable to update your language." });
  }
});

module.exports = router;
