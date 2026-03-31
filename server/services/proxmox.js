import axios from 'axios';
import https from 'node:https';
import config from '../config.js';

const baseURL = `https://${config.proxmox.host}:${config.proxmox.port}/api2/json`;

const agent = new https.Agent({ rejectUnauthorized: false });

export function createClient(ticket, csrfToken) {
  return axios.create({
    baseURL,
    httpsAgent: agent,
    headers: {
      Cookie: `PVEAuthCookie=${ticket}`,
      CSRFPreventionToken: csrfToken,
    },
  });
}

export async function authenticate(username, password, realm = 'pam') {
  const res = await axios.post(
    `${baseURL}/access/ticket`,
    new URLSearchParams({ username: `${username}@${realm}`, password }),
    { httpsAgent: agent }
  );
  return res.data.data;
}
