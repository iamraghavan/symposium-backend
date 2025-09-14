// middleware/cache.js
const store = new Map();

/**
 * cache(ttlMs)
 * Caches GET responses (status 200) for ttlMs per URL+query.
 */
module.exports = function cache(ttlMs = 30_000) {
  return function (req, res, next) {
    if (req.method !== "GET") return next();

    const key = req.originalUrl;
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.expires > now) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(hit.payload);
    }

    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) {
        store.set(key, { expires: now + ttlMs, payload: body });
        res.setHeader("X-Cache", "MISS");
      }
      return json(body);
    };
    next();
  };
};
