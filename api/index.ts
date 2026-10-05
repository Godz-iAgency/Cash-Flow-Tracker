import { createApp } from '../server/app';

// Vercel runs this handler; local preview startup remains in server/index.ts.
export default createApp({ hosted: true });
