const dotenv = require('dotenv');

function loadEnv() {
  // Load environment variables from backend/.env by default.
  // If you set ENV_PATH explicitly, load it instead.
  const envPath = process.env.ENV_PATH;
  if (envPath) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }
}

module.exports = { loadEnv };

