//Nicholas Imperioli - 261120345
const { MongoClient } = require("mongodb");

let db;

const connectDB = async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  const mongoTimeout = setTimeout(() => {console.error("Cannot connect to MongoDB server: connection timed out")}, 10000)
  await client.connect();
  db = client.db(process.env.DB_NAME);
  clearTimeout(mongoTimeout);
  console.log("MongoDB connected");

  await db.collection("invalidated_tokens").createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "ttl_expires_at" }
  );
  console.log("TTL index ensured on invalidated_tokens");
};

const getDB = () => db;

module.exports = { connectDB, getDB };