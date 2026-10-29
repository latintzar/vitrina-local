import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@scope/ui';
import App from './App';
import { installDemo } from './demo';
import './index.css';
installDemo();
createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider defaultTheme="vitrina_sky"><App /></ThemeProvider></StrictMode>);
