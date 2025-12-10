"""Script to load CSV files into SQLite database."""
import pandas as pd
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from config import settings
from models import Base, MMSIAnomalyScore, MMSIDaily, MPA, EEZ, EEZBoundaries, VesselFeatures
from datetime import datetime

# Add parent directory to path to import config
sys.path.insert(0, str(Path(__file__).parent))

# Paths to CSV files (relative to project root)
DATA_DIR = Path(__file__).parent.parent.parent / "analysis" / "data"

def create_tables():
    """Create all database tables."""
    engine = create_engine(settings.DATABASE_URL)
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")


def load_mmsi_anomaly_scores(chunk_size=10000):
    """Load MMSI anomaly scores CSV into database."""
    csv_path = DATA_DIR / "mmsi_anomaly_scores.csv"
    if not csv_path.exists():
        print(f"Error: {csv_path} not found!")
        return
    
    engine = create_engine(settings.DATABASE_URL)
    
    print(f"Loading {csv_path.name}...")
    print("This may take a while for large files...")
    
    # Clear existing data 
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM mmsi_anomaly_scores"))
        conn.commit()
    
    # Load in chunks
    total_rows = 0
    for chunk in pd.read_csv(csv_path, chunksize=chunk_size):
        chunk.to_sql(
            'mmsi_anomaly_scores',
            engine,
            if_exists='append',
            index=False
        )
        total_rows += len(chunk)
        print(f"Loaded {total_rows:,} rows...", end='\r')
    
    print(f"\n Successfully loaded {total_rows:,} rows from {csv_path.name}")


def load_mmsi_daily(chunk_size=50000):
    """Load MMSI daily CSV into database."""
    csv_path = DATA_DIR / "mmsi_daily.csv"
    if not csv_path.exists():
        print(f"Error: {csv_path} not found!")
        return
    
    engine = create_engine(settings.DATABASE_URL)
    
    print(f"Loading {csv_path.name}...")
    print("This is a large file, loading in chunks...")
    
    # Clear existing data (SQLite doesn't support TRUNCATE CASCADE)
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM mmsi_daily"))
        conn.commit()
    
    # Load in chunks
    total_rows = 0
    for chunk in pd.read_csv(csv_path, chunksize=chunk_size, parse_dates=['date']):
        chunk.to_sql(
            'mmsi_daily',
            engine,
            if_exists='append',
            index=False
        )
        total_rows += len(chunk)
        print(f"Loaded {total_rows:,} rows...", end='\r')
    
    print(f"\nLoaded {total_rows:,} rows from {csv_path.name}")


def load_mpa(chunk_size=5000):
    """Load MPA CSV into database."""
    csv_path = DATA_DIR / "mpa.csv"
    if not csv_path.exists():
        print(f"Error: {csv_path} not found!")
        return
    
    engine = create_engine(settings.DATABASE_URL)
    
    print(f"Loading {csv_path.name}...")
    
    # Clear existing data 
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM mpa"))
        conn.commit()
    
    # Read first chunk to get column names and check for duplicates
    first_chunk = True
    seen_wdpaid = set()
    total_rows = 0
    skipped_duplicates = 0
    
    for chunk in pd.read_csv(csv_path, chunksize=chunk_size):
        # Convert column names from uppercase to lowercase to match database model
        chunk.columns = chunk.columns.str.lower()
        
        # Drop duplicates on wdpaid within this chunk
        chunk_before = len(chunk)
        chunk = chunk.drop_duplicates(subset=['wdpaid'], keep='first')
        if len(chunk) < chunk_before:
            skipped_duplicates += (chunk_before - len(chunk))
        
        # Filter out wdpaid values already seen
        if 'wdpaid' in chunk.columns:
            chunk = chunk[~chunk['wdpaid'].isin(seen_wdpaid)]
            seen_wdpaid.update(chunk['wdpaid'].tolist())
        
        if len(chunk) == 0:
            continue
        
        try:
            chunk.to_sql(
                'mpa',
                engine,
                if_exists='append',
                index=False
            )
            total_rows += len(chunk)
            print(f"Loaded {total_rows:,} rows...", end='\r')
        except Exception as e:
            print(f"\nError loading chunk: {e}")
            # Try to continue with next chunk
            continue
    
    print(f"\nLoaded {total_rows:,} rows from {csv_path.name}")
    if skipped_duplicates > 0:
        print(f"Skipped {skipped_duplicates:,} duplicate rows")


def load_eez():
    """Load EEZ CSV into database."""
    csv_path = DATA_DIR / "eez.csv"
    if not csv_path.exists():
        print(f"Error: {csv_path} not found!")
        return
    
    engine = create_engine(settings.DATABASE_URL)
    
    print(f"Loading {csv_path.name}...")
    
    # Clear existing data 
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM eez"))
        conn.commit()
    
    # Load entire file (should be manageable size)
    df = pd.read_csv(csv_path)
    df.to_sql(
        'eez',
        engine,
        if_exists='append',
        index=False
    )
    
    print(f"Loaded {len(df):,} rows from {csv_path.name}")


def load_eez_boundaries():
    """Load EEZ boundaries CSV into database."""
    csv_path = DATA_DIR / "eez_boundaries.csv"
    if not csv_path.exists():
        print(f"Error: {csv_path} not found!")
        return
    
    engine = create_engine(settings.DATABASE_URL)
    
    print(f"Loading {csv_path.name}...")
    
    # Clear existing data (SQLite doesn't support TRUNCATE CASCADE)
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM eez_boundaries"))
        conn.commit()
    
    # Load entire file (should be manageable size)
    # Convert column names from uppercase to snake_case to match database model
    df = pd.read_csv(csv_path)
    
    # Parse date column with error handling
    if 'DOC_DATE' in df.columns:
        df['DOC_DATE'] = pd.to_datetime(df['DOC_DATE'], errors='coerce')
    
    # Map CSV column names (uppercase) to database column names (snake_case)
    column_mapping = {
        'LINE_ID': 'line_id',
        'LINE_NAME': 'line_name',
        'LINE_TYPE': 'line_type',
        'MRGID_SOV1': 'mrgid_sov1',
        'MRGID_TER1': 'mrgid_ter1',
        'TERRITORY1': 'territory1',
        'SOVEREIGN1': 'sovereign1',
        'MRGID_TER2': 'mrgid_ter2',
        'TERRITORY2': 'territory2',
        'MRGID_SOV2': 'mrgid_sov2',
        'SOVEREIGN2': 'sovereign2',
        'MRGID_EEZ1': 'mrgid_eez1',
        'EEZ1': 'eez1',
        'MRGID_EEZ2': 'mrgid_eez2',
        'EEZ2': 'eez2',
        'SOURCE1': 'source1',
        'URL1': 'url1',
        'SOURCE2': 'source2',
        'URL2': 'url2',
        'SOURCE3': 'source3',
        'URL3': 'url3',
        'ORIGIN': 'origin',
        'DOC_DATE': 'doc_date',
        'MRGID_JREG': 'mrgid_jreg',
        'JOINT_REG': 'joint_reg',
        'LENGTH_KM': 'length_km',
        'MRGID_EEZ3': 'mrgid_eez3',
        'EEZ3': 'eez3',
        'TERRITORY3': 'territory3',
        'MRGID_TER3': 'mrgid_ter3',
        'SOVEREIGN3': 'sovereign3',
        'MRGID_SOV3': 'mrgid_sov3',
    }
    
    df = df.rename(columns=column_mapping)
    
    df.to_sql(
        'eez_boundaries',
        engine,
        if_exists='append',
        index=False
    )
    
    print(f"Loaded {len(df):,} rows from {csv_path.name}")


def load_vessel_features(chunk_size=10000):
    """Load vessel features CSV into database."""
    csv_path = DATA_DIR / "vessel_features_all.csv"
    if not csv_path.exists():
        print(f"Error: {csv_path} not found!")
        return
    
    engine = create_engine(settings.DATABASE_URL)
    
    print(f"Loading {csv_path.name}...")
    print("This may take a while for large files...")
    
    # Clear existing data (SQLite doesn't support TRUNCATE CASCADE)
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM vessel_features_all"))
        conn.commit()
    
    # Load in chunks
    total_rows = 0
    for chunk in pd.read_csv(csv_path, chunksize=chunk_size):
        # Convert boolean columns
        bool_cols = ['self_reported_fishing_vessel', 'is_known_iuu']
        for col in bool_cols:
            if col in chunk.columns:
                chunk[col] = chunk[col].astype(str).str.upper() == 'TRUE'
        
        chunk.to_sql(
            'vessel_features_all',
            engine,
            if_exists='append',
            index=False
        )
        total_rows += len(chunk)
        print(f"Loaded {total_rows:,} rows...", end='\r')
    
    print(f"\n Successfully loaded {total_rows:,} rows from {csv_path.name}")


def main():
    """Main function to load all data."""
    print("=" * 60)
    print("Data Loading Script for SQLite")
    print("=" * 60)
    print(f"Database: {settings.DATABASE_URL}")
    print(f"Data directory: {DATA_DIR}")
    print("=" * 60)
    
    # Create tables
    create_tables()
    
    # Load data
    print("\n1. Loading MMSI Anomaly Scores...")
    load_mmsi_anomaly_scores()

    print("\n2. Loading MMSI Daily Data...")
    load_mmsi_daily()
    
    print("\n3. Loading MPA Data...")
    load_mpa()
    
    print("\n4. Loading EEZ Data...")
    load_eez()
    
    print("\n5. Loading EEZ Boundaries Data...")
    load_eez_boundaries()
    
    print("\n6. Loading Vessel Features Data...")
    load_vessel_features()
    
    print("\n" + "=" * 60)
    print("All data loaded successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()

