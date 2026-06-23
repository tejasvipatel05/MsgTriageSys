const CANONICAL_CATEGORIES = [
  "Billing",
  "Technical Support",
  "Account",
  "Order",
  "Refund",
  "Complaint",
  "Feedback",
  "General Inquiry",
  "Other",
];

const CATEGORY_SYNONYMS = {
  Technical: "Technical Support",
  "Tech Support": "Technical Support",
  Shipping: "Order",
  Delivery: "Order",
  "Password Reset": "Account",
  Password: "Account",
  "Product Information": "General Inquiry",
  Inquiry: "General Inquiry",
};

function normalizeCategory(category) {
  if (typeof category !== "string") {
    return category;
  }

  const trimmed = category.trim();

  if (CANONICAL_CATEGORIES.includes(trimmed)) {
    return trimmed;
  }

  if (Object.prototype.hasOwnProperty.call(CATEGORY_SYNONYMS, trimmed)) {
    return CATEGORY_SYNONYMS[trimmed];
  }

  return trimmed;
}

module.exports = {
  CANONICAL_CATEGORIES,
  CATEGORY_SYNONYMS,
  normalizeCategory,
};
