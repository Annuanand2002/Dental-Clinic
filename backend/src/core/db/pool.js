const mysql = require('mysql2/promise');

let poolSingleton = null;

function createPoolFromEnv() {
  // mysql2 pool using environment variables.
  return mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: Math.min(50, Math.max(4, Number(process.env.DB_CONNECTION_LIMIT || 16))),
    queueLimit: 0,
    // Keep timestamps as strings to avoid locale/timezone issues.
    dateStrings: true
  });
}

function getPool() {
  if (poolSingleton) return poolSingleton;
  poolSingleton = createPoolFromEnv();
  return poolSingleton;
}

module.exports = { getPool };

