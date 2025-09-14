require("dotenv").config();
const app = require("./server");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 8000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
