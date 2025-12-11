import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MapDataProvider } from './contexts/MapDataContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VesselMap from './pages/VesselMap';
import VesselSearch from './pages/VesselSearch';
import Predictions from './pages/Predictions';
import Analytics from './pages/Analytics';
import Hotspots from './pages/Hotspots';
import VesselPrediction from './pages/VesselPrediction';
import MainPage from './pages/MainPage';

function App() {
  return (
    <MapDataProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/map" element={<VesselMap />} />
            <Route path="/search" element={<VesselSearch />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/prediction" element={<VesselPrediction />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/hotspots" element={<Hotspots />} />
          </Routes>
        </Layout>
      </Router>
    </MapDataProvider>
  );
}

export default App;
