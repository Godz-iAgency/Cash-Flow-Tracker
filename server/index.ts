import { createApp } from './app.js';

const app = createApp();
app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log(`Cash Flow Tracker running at http://localhost:${process.env.PORT || 3001}`));
