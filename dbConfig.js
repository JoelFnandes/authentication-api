require("dotenv").config();

const { Pool } = require("pg");

const isProdution = process.env.NODE_ENV === "production";

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

const pool = new Pool({
    connectionString: isProdution ? process.env.DATABASE_URL : connectionString
})

module.exports = {pool};