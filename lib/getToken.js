import axios from "axios";

// -------- RUIJIE ENV --------
const ruijieBaseURL = process.env.RUIJIE_BASE;   // your custom base, includes token param
const ruijieAppId = process.env.RUIJIE_APP_ID;
const ruijieSecret = process.env.RUIJIE_SECRET;

// -------- OMADA ENV --------
const OMADA_BASE_URL = process.env.OMADA_BASE_URL;
const OMADA_EMAIL = process.env.OMADA_EMAIL;
const OMADA_PASSWORD = process.env.OMADA_PASSWORD;
const OMADA_CLIENT_ID = process.env.OMADA_CLIENT_ID;
const OMADA_CLIENT_SECRET = process.env.OMADA_CLIENT_SECRET;
const OMADA_OMADAC_ID = process.env.OMADA_OMADAC_ID;

// -------- CACHES --------
let ruijieTokenCache = null;
let ruijieTokenExpiry = null;

let omadaTokenCache = null;
let omadaTokenExpiry = null;

/* ---------------------------------------------------
   🔹 Omada Token Handler
---------------------------------------------------- */
export async function getOmadaToken() {
  const now = new Date();

  if (omadaTokenCache && omadaTokenExpiry && now < omadaTokenExpiry) {
    return omadaTokenCache;
  }

  const checkResponse = (data, action) => {
    if (!data || data.errorCode !== 0) {
      throw new Error(`${action} failed: ${JSON.stringify(data)}`);
    }
  };

  try {
    // Step 1: Login
    const loginRes = await axios.post(
      `${OMADA_BASE_URL}/openapi/authorize/login?client_id=${OMADA_CLIENT_ID}&omadac_id=${OMADA_OMADAC_ID}`,
      { 
        username: OMADA_EMAIL, 
        password: OMADA_PASSWORD 
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const loginData = loginRes.data;
    checkResponse(loginData, 'Login');

    const { csrfToken, sessionId } = loginData.result;

    // Step 2: Get Authorization Code
    const authRes = await axios.post(
      `${OMADA_BASE_URL}/openapi/authorize/code?client_id=${OMADA_CLIENT_ID}&omadac_id=${OMADA_OMADAC_ID}&response_type=code`,
      '',
      {
        headers: {
          'Content-Type': 'application/json',
          'csrf-token': csrfToken,
          'Cookie': `TPOMADA_SESSIONID=${sessionId}`,
        },
      }
    );

    const authData = authRes.data;
    checkResponse(authData, 'Authorization');

    const authCode = authData.result;

    // Step 3: Get Access Token
    const tokenRes = await axios.post(
      `${OMADA_BASE_URL}/openapi/authorize/token?grant_type=authorization_code&code=${authCode}`,
      { 
        client_id: OMADA_CLIENT_ID, 
        client_secret: OMADA_CLIENT_SECRET 
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const tokenData = tokenRes.data;
    checkResponse(tokenData, 'Access token retrieval');

    const accessToken = tokenData.result.accessToken;
    
    // Cache the token (Omada tokens typically expire in 1 hour = 3600 seconds)
    omadaTokenCache = accessToken;
    omadaTokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour
    
    return accessToken;
  } catch (error) {
    console.error('Failed to get Omada access token:', error.message);
    throw error;
  }
}

/* ---------------------------------------------------
   🔹 Ruijie Token Handler (JSON body as requested)
---------------------------------------------------- */
export async function getRuijieToken() {
  const now = new Date();

  if (ruijieTokenCache && ruijieTokenExpiry && now < ruijieTokenExpiry) {
    return ruijieTokenCache;
  }

  const res = await axios.post(
    ruijieBaseURL,             // you supplied full URL in .env
    {
      appid: ruijieAppId,
      secret: ruijieSecret,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  const { code, accessToken, expired } = res.data;

  if (code !== 0 || !accessToken) {
    throw new Error("Failed to get Ruijie token: " + res.data.msg);
  }

  ruijieTokenCache = accessToken;
  ruijieTokenExpiry = new Date(Date.now() + expired * 1000); // usually 7200 seconds

  return ruijieTokenCache;
}

// Optional: Export both functions as default for convenience
export default {
  getOmadaToken,
  getRuijieToken
};