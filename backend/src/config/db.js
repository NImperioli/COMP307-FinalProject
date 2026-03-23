//Nicholas Imperioli - 261120345
const { MongoClient } = require("mongodb");

let db;

const connectDB = async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME);
  console.log("MongoDB connected");
};

const getDB = () => db;

module.exports = { connectDB, getDB };