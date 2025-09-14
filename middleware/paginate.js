// middleware/paginate.js
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

module.exports = function paginate(req, res, next) {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit || DEFAULT_LIMIT, 10), 1),
    MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  // sort: ?sort=-createdAt,name
  const sort = (req.query.sort || "")
    .split(",")
    .filter(Boolean)
    .join(" ");

  // fields: ?fields=name,email
  const select = (req.query.fields || "")
    .split(",")
    .filter(Boolean)
    .join(" ");

  // naive filter: anything else in query that isn't our control param is treated as filter
  const control = new Set(["page", "limit", "sort", "fields"]);
  const filter = Object.fromEntries(
    Object.entries(req.query).filter(([k]) => !control.has(k))
  );

  res.locals.page = { page, limit, skip, sort, select, filter };
  next();
};
