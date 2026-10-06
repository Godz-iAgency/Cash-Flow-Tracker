import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './theme.css';
import './water-tokens.css';
import './water-effects.css';
import './simple.css';
import { WaterThemeProvider } from './WaterTheme';
import { PwaProvider } from './Pwa';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><WaterThemeProvider><PwaProvider><App /></PwaProvider></WaterThemeProvider></React.StrictMode>);
