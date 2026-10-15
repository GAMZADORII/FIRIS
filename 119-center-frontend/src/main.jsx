import './assets/styles/typography.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './assets/styles/global.css';
import './components/Header/Header.css';
import './pages/Reception/Reception.css';
import './components/ResponseMap/ResponseMap.css';
import './pages/History/History.css';
import './components/FacilityPlan/FacilityPlan.css';
import './assets/styles/responsive.css';
import './assets/styles/readability.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
