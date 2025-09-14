const logger = require("../utils/logger");

module.exports = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ message: "Something went wrong" });
};
