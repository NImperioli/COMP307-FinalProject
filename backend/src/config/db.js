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
};

const getDB = () => db;

module.exports = { connectDB, getDB };