console.log("=== analyzeRoutes loaded ===");
const express = require("express");
const { analyze, analyzeBatch } = require("../controllers/analyzeController");

const router = express.Router();

router.post("/analyze", analyze);
router.post("/analyze-batch", analyzeBatch);

router.get("/test", (req, res) => {
  res.json({ success: true });
});

module.exports = router;
