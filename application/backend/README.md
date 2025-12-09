# DataMining Backend API

FastAPI backend for serving vessel and geographic data from SQLite.

## Prerequisites

- **Python 3.11.x** (required)
- pip (Python package manager)

**Verify Python version:**
```bash
python --version
# or
python3 --version
```

You should see `Python 3.11.x`. If you have a different version, please install Python 3.11.x from [python.org](https://www.python.org/downloads/).

## Setup

### 1. Create Virtual Environment

It's recommended to use a virtual environment to isolate project dependencies.

**On Windows:**
```bash
cd application/backend
python3.11 -m venv venv
venv\Scripts\activate
```

If `python3.11` is not available, use `py -3.11`:
```bash
py -3.11 -m venv venv
venv\Scripts\activate
```

**On Linux/Mac:**
```bash
cd application/backend
python3.11 -m venv venv
source venv/bin/activate
```

After activation, your terminal prompt should show `(venv)`.

**To deactivate the virtual environment later:**
```bash
deactivate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Database

1. Copy the environment file (optional, SQLite works with defaults):
```bash
cp .env.example .env
```

2. Edit `.env` if you want to customize the database location:
```env
DATABASE_URL=sqlite:///./datamining.db
```

**Note:** SQLite is file-based, so no separate database server is needed. The database file will be created automatically in the backend directory.

### 4. Load Data

Run the data loading script to import CSV files into SQLite:

```bash
python load_data.py
```

This will:
- Create all necessary database tables
- Load `mmsi_anomaly_scores.csv`
- Load `mmsi_daily.csv` (large file, loaded in chunks)
- Load `mpa.csv`
- Load `eez.csv`
- Load `eez_boundaries.csv`
- Load `vessel_features_all.csv` (large file, loaded in chunks)

**Note:** The `mmsi_daily.csv` file is very large (>200MB), so loading may take some time.

### 5. Run the API Server

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Alternative Docs: http://localhost:8000/redoc

## API Endpoints

### Anomaly Scores
- `GET /api/anomaly-scores` - Get anomaly scores with filtering and pagination
- `GET /api/anomaly-scores/{mmsi}` - Get anomaly scores for a specific MMSI

### MMSI Daily Data
- `GET /api/mmsi-daily` - Get daily MMSI data with filtering
- `GET /api/mmsi-daily/{mmsi}` - Get daily data for a specific MMSI

### Marine Protected Areas (MPA)
- `GET /api/mpa` - Get MPA data with filtering
- `GET /api/mpa/{mpa_id}` - Get a specific MPA by ID

### Exclusive Economic Zones (EEZ)
- `GET /api/eez` - Get EEZ data with filtering
- `GET /api/eez/{eez_id}` - Get a specific EEZ by ID

### EEZ Boundaries
- `GET /api/eez-boundaries` - Get EEZ boundaries with filtering
- `GET /api/eez-boundaries/{line_id}` - Get a specific EEZ boundary by line ID

### Vessel Features
- `GET /api/vessel-features` - Get vessel features with filtering and pagination
- `GET /api/vessel-features/{mmsi}` - Get vessel features for a specific MMSI

### Statistics
- `GET /api/stats/summary` - Get summary statistics for all tables

## Query Parameters

### Pagination
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 100, max: 1000)

### Filtering
- `mmsi`: Filter by MMSI number
- `start_date` / `end_date`: Date range filtering
- `north` / `south` / `east` / `west`: Geographic bounding box
- `iso3` / `iso_ter1`: Country/territory codes
- `name` / `geoname`: Text search
- `year`: Filter by year (for vessel features)
- `is_known_iuu`: Filter by IUU status (boolean)
- `flag_ais` / `flag_registry` / `flag_gfw`: Filter by flag state
- `vessel_class`: Search vessel class across inferred, registry, and gfw fields
- `territory1` / `sovereign1`: Filter EEZ boundaries by territory or sovereign
- `line_type`: Filter EEZ boundaries by line type

## Example Queries

```bash
# Get top 10 anomaly scores
curl "http://localhost:8000/api/anomaly-scores?page=1&page_size=10&min_score=0.5"

# Get daily data for a specific MMSI
curl "http://localhost:8000/api/mmsi-daily/272364000"

# Get MPA data for a country
curl "http://localhost:8000/api/mpa?iso3=USA"

# Get summary statistics
curl "http://localhost:8000/api/stats/summary"
```

## Database Schema

The database includes the following tables:
- `mmsi_anomaly_scores`: Vessel anomaly scores
- `mmsi_daily`: Daily vessel position and activity data
- `mpa`: Marine Protected Areas
- `eez`: Exclusive Economic Zones
- `eez_boundaries`: EEZ boundary lines
- `vessel_features_all`: Aggregated vessel features and characteristics

All tables include appropriate indexes for fast querying.

