import 'dotenv/config';

export default {
  proxmox: {
    host: process.env.PROXMOX_HOST || '127.0.0.1',
    port: parseInt(process.env.PROXMOX_PORT || '8006', 10),
  },
  session: {
    secret: process.env.SESSION_SECRET || 'change-me',
  },
  port: parseInt(process.env.PORT || '3000', 10),
};
