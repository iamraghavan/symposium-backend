// lib/http.js
exports.ok = (res, status, payload) => res.status(status).json({ success: true, ...payload });
exports.fail = (res, status, message, details=null) => res.status(status).json({ success: false, message, details });

// lib/paging.js
exports.pickPaging = (req, { defLimit=20, maxLimit=100 } = {}) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit || String(defLimit), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// lib/dates.js
exports.pickRange = (req, { defDays=30 } = {}) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - defDays*864e5);
  const to   = req.query.to   ? new Date(req.query.to)   : new Date();
  return { from, to };
};
