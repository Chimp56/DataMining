import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
// Import Leaflet CSS globally
import 'leaflet/dist/leaflet.css';
// Fix Leaflet default icon paths (must be imported before any Leaflet components)
import './utils/leafletFix';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Temporarily disable StrictMode to avoid react-leaflet double-initialization issue
// This is a known compatibility issue between React 18 StrictMode and react-leaflet
// https://github.com/PaulLeCam/react-leaflet/issues/936
const shouldUseStrictMode = false;

root.render(
  shouldUseStrictMode ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  )
);
