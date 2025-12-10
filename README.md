# IUU Fishing Detection System

A comprehensive data mining application for detecting and analyzing illegal, unreported, and unregulated (IUU) fishing activities using machine learning, spatial-temporal analysis, and vessel location prediction.

**Project Proposal:** [View Document](https://docs.google.com/document/d/1LIuGbBhWvKnRHjlkPEYSIRxw1h_tBj3b/edit?usp=sharing&ouid=112861755990698654302&rtpof=true&sd=true)

## Project Structure

```
DataMining/
├── analysis/              # R project for data analysis and ML models
│   ├── data/              # Data files (CSV, RData, shapefiles, DuckDB)
│   └── scripts/           # R scripts for analysis, models, and API
├── application/           # Web application
│   ├── backend/           # FastAPI backend (Python)
│   └── frontend/          # React frontend (TypeScript)
└── README.md              # This file
```

## Features

- **IUU Vessel Detection**: Custom Isolation Forest model for anomaly scoring
- **Spatial-Temporal Hotspots**: DBSCAN clustering for identifying fishing hotspots
- **Vessel Location Prediction**: Random Forest models for predicting next-day vessel positions
- **Interactive Maps**: EEZ boundaries, Marine Protected Areas (MPA), and vessel tracking
- **Real-time Analytics**: Dashboard with statistics and risk assessments
- **Caching System**: File-based caching for hotspots and predictions to reduce runtime

## Prerequisites

### Backend (Python)
- Python 3.8+
- pip

### Frontend (Node.js)
- Node.js 16+ (20+ recommended)
- npm or yarn

### R API
- R 4.x
- R packages: `plumber`, `data.table`, `dplyr`, `duckdb`, `randomForest`, `rnaturalearth`, `sf`, `lubridate`, `tidyr`, `glue`

### Data Files
- Large datasets stored in Google Drive (see project proposal)
- Shapefiles for EEZ and MPA boundaries in `analysis/data/`

## Installation

### 1. Backend Setup

```bash
cd application/backend
pip install -r requirements.txt
```

**Required Python packages:**
- fastapi, uvicorn
- sqlalchemy, pandas
- geopandas (for map geometry)
- httpx (for R API communication)

### 2. Frontend Setup

```bash
cd application/frontend
npm install
```

### 3. R API Setup

```r
# Install required R packages
install.packages(c(
  "plumber", "data.table", "dplyr", "duckdb", 
  "randomForest", "rnaturalearth", "rnaturalearthdata",
  "sf", "lubridate", "tidyr", "glue"
))
```

See `analysis/scripts/README_R_API.md` for detailed R API setup instructions.

## Database Setup

### 1. Create Database Tables

```bash
cd application/backend
python -c "from load_data import create_tables; create_tables()"
```

### 2. Load Data

The `load_data.py` script provides functions to load CSV files into the SQLite database:

```python
from load_data import (
    load_mmsi_anomaly_scores,
    load_mmsi_daily,
    load_mpa,
    load_eez,
    load_eez_boundaries,
    load_vessel_features
)

# Load data (with UPSERT support)
load_mmsi_daily(chunk_size=50000, upsert=True)  # Updates existing, inserts new
load_mmsi_anomaly_scores()
load_mpa()
load_eez()
load_eez_boundaries()
load_vessel_features()
```

**Note:** `load_mmsi_daily()` supports UPSERT mode (default: `upsert=True`) to update existing records instead of deleting the entire table.

### 3. R Data Files

Generate R data files for the R API:

```r
# From analysis/ directory
source("scripts/build_dataset.R")  # Creates vessel_features_all.RData
```

## Running the Application

### 1. Start R Plumber API (Port 8001)

**Windows (PowerShell):**
```powershell
cd analysis/scripts
.\start_r_api.ps1
```

**Windows (Batch):**
```cmd
cd analysis\scripts
start_r_api.bat
```

**R Console:**
```r
setwd("analysis")
library(plumber)
plumber::pr("scripts/deploy.R") |> pr_run(port = 8001)
```

**Verify API is running:**
- Health check: http://127.0.0.1:8001/health
- Swagger docs: http://127.0.0.1:8001/__docs__/

### 2. Start FastAPI Backend (Port 8000)

```bash
cd application/backend
uvicorn main:app --reload --port 8000
```

**Verify backend is running:**
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

### 3. Start React Frontend (Port 3000)

```bash
cd application/frontend
npm run dev
```

**Access the application:**
- Frontend: http://localhost:3000
- Default routes:
  - `/` - Main page
  - `/dashboard` - Dashboard
  - `/map` - Vessel map with EEZ/MPA layers
  - `/search` - Vessel search
  - `/predictions` - IUU predictions
  - `/hotspots` - Spatial-temporal hotspots
  - `/vessel-prediction` - Vessel location prediction
  - `/analytics` - Analytics

## Configuration

### Backend Environment Variables

Create `application/backend/.env`:
```env
DATABASE_URL=sqlite:///./data/iuu_detection.db
R_API_URL=http://127.0.0.1:8001
```

### Frontend Environment Variables

Create `application/frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```

## API Endpoints

### FastAPI Backend (Port 8000)

**Vessel Data:**
- `GET /api/vessels/{mmsi}` - Get vessel by MMSI
- `GET /api/vessel-features` - List vessel features
- `GET /api/mmsi-daily` - Daily vessel data

**Predictions & Scores:**
- `GET /api/predictions` - Get anomaly scores
- `GET /api/predict/{mmsi}` - Predict vessel location
- `POST /api/model/train` - Retrain Isolation Forest model

**Hotspots:**
- `GET /api/hotspots/global` - Global spatial-temporal hotspots
- `GET /api/hotspots/vessel/{mmsi}` - Vessel-specific hotspots

**Map Data:**
- `GET /api/map/eez-boundaries` - EEZ boundaries with geometry
- `GET /api/map/mpa` - Marine Protected Areas with geometry

**Dashboard:**
- `GET /api/dashboard/stats` - Dashboard statistics

### R Plumber API (Port 8001)

**Model:**
- `GET /health` - API health and model status
- `GET /scores?top_n=50` - Top anomaly scores
- `GET /score/{mmsi}` - Score for specific MMSI
- `POST /train` - Train/retrain model

**Hotspots:**
- `GET /hotspots/global?start_year=2017&end_year=2019` - Global hotspots
- `GET /hotspots/vessel/{mmsi}?start_year=2017&end_year=2019` - Vessel hotspots

**Predictions:**
- `GET /predict/{mmsi}?days_ahead=5&start_year=2017&end_year=2019` - Vessel location prediction

**Cache Management:**
- `GET /cache/info?prefix=...` - Cache information
- `POST /cache/clear?prefix=...&max_age_hours=168` - Clear old cache

## Caching

The R API implements file-based caching to reduce runtime:

- **Hotspots**: Cached by `start_year`, `end_year`, and `mmsi`
- **Vessel Predictions**: Cached by `mmsi`, `days_ahead`, `start_year`, `end_year`
- **Models**: Trained Random Forest models cached by `mmsi`, `start_year`, `end_year`

Cache files are stored in `analysis/data/cache/` and can be managed via the cache API endpoints.

## Data Loading

### CSV Files Location

Place CSV files in `analysis/data/`:
- `mmsi_daily.csv` - Daily vessel position data
- `mmsi_anomaly_scores.csv` - Anomaly scores
- `mpa.csv` - Marine Protected Areas metadata
- `eez.csv` - Exclusive Economic Zones metadata
- `eez_boundaries.csv` - EEZ boundaries metadata
- `vessel_features_all.csv` - Vessel features for ML model

### Shapefiles

Required shapefiles for map display:
- `analysis/data/World_EEZ_v12_20231025/eez_boundaries_v12.shp` - EEZ boundaries
- `analysis/data/World_EEZ_v12_20231025/eez_v12.shp` - EEZ polygons
- `analysis/data/WDPA_WDOECM_Oct2025_Public_marine_shp_*/WDPA_WDOECM_Oct2025_Public_marine_shp-polygons.shp` - MPA polygons (3 directories)

**Note:** Large data files are stored in Google Drive. See project proposal document for access.

## Common Tasks

### Retrain the Isolation Forest Model

```bash
# Via API
curl -X POST http://localhost:8001/train

# Or from frontend: Click "Train Model" button in Predictions page
```

### Load New Data Incrementally

```python
# Update existing records, insert new ones
from load_data import load_mmsi_daily
load_mmsi_daily(chunk_size=50000, upsert=True)
```

### Clear Old Cache

```bash
# Clear cache older than 1 week
curl -X POST "http://localhost:8001/cache/clear?max_age_hours=168"
```

### Check API Health

```bash
# FastAPI backend
curl http://localhost:8000/api/health

# R Plumber API
curl http://127.0.0.1:8001/health
```

## Troubleshooting

### R API Not Starting

1. **R not in PATH**: Run `analysis/scripts/find_r_path.ps1` to locate R installation
2. **Missing packages**: Install required R packages (see R API Setup)
3. **Data file missing**: Run `build_dataset.R` to generate `vessel_features_all.RData`

### Backend Can't Connect to R API

1. Verify R API is running on port 8001
2. Check `R_API_URL` in backend `.env` file
3. Test R API health endpoint directly

### Map Not Displaying EEZ/MPA

1. **Install geopandas**: `pip install geopandas`
2. **Verify shapefiles exist**: Check paths in `application/backend/main.py`
3. **Check browser console**: Look for geometry loading errors

### Database Errors

1. **Create tables first**: Run `create_tables()` from `load_data.py`
2. **Check file paths**: Ensure CSV files are in `analysis/data/`
3. **UPSERT issues**: Use `upsert=False` to delete and reload if needed

## Development

### Project Components

- **Backend**: FastAPI with SQLAlchemy ORM, SQLite database
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + React Leaflet
- **R API**: Plumber API with custom ML models (Isolation Forest, Random Forest, DBSCAN)
- **Data Processing**: R scripts for data preparation and analysis

### Key Scripts

- `analysis/scripts/build_dataset.R` - Build vessel features dataset
- `analysis/scripts/deploy.R` - R Plumber API endpoints
- `analysis/scripts/isolation_forest_iuu.R` - Custom Isolation Forest implementation
- `analysis/scripts/hotspot_analysis.R` - Hotspot detection with DBSCAN
- `analysis/scripts/vessel_prediction.R` - Vessel location prediction
- `application/backend/load_data.py` - Database data loading utilities

## License

This project is for academic/research purposes. See project proposal for details.

## Support

For issues or questions, refer to:
- R API documentation: `analysis/scripts/README_R_API.md`
- Frontend documentation: `application/frontend/README.md`
- Project proposal document (link at top)
