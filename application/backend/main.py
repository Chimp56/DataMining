"""FastAPI application main file."""
from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import Optional, List
from datetime import date, datetime
import logging
import json
from pathlib import Path
import pandas as pd
from functools import lru_cache
import hashlib

from config import settings
from database import get_db
from models import MMSIAnomalyScore, MMSIDaily, MPA, EEZ, EEZBoundaries, VesselFeatures
from r_api_client import r_api_client
from schemas import (
    MMSIAnomalyScoreResponse,
    MMSIDailyResponse,
    MPAResponse,
    EEZResponse,
    EEZBoundariesResponse,
    VesselFeaturesResponse,
    PaginatedResponse,
    BoundsQuery
)

logger = logging.getLogger(__name__)

# In-memory cache for EEZ boundaries GeoDataFrame
_eez_gdf_cache = None
_eez_gdf_cache_path = None

# In-memory cache for MPA GeoDataFrame
_mpa_gdf_cache = None
_mpa_gdf_cache_paths = None

# In-memory cache for predictions (only caches small initial batches, not full dataset)
_predictions_cache = None
_predictions_cache_time = None
_predictions_cache_ttl_seconds = 300  # Cache for 5 minutes

app = FastAPI(
    title="DataMining API",
    description="API for serving vessel and geographic data",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "DataMining API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# ==================== MMSI Anomaly Scores Endpoints ====================

@app.get("/api/anomaly-scores", response_model=PaginatedResponse)
async def get_anomaly_scores(
    mmsi: Optional[int] = Query(None, description="Filter by MMSI"),
    min_score: Optional[float] = Query(None, description="Minimum anomaly score"),
    max_score: Optional[float] = Query(None, description="Maximum anomaly score"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get anomaly scores with pagination and filtering."""
    query = db.query(MMSIAnomalyScore)
    
    if mmsi:
        query = query.filter(MMSIAnomalyScore.mmsi == mmsi)
    if min_score is not None:
        query = query.filter(MMSIAnomalyScore.anomaly_score >= min_score)
    if max_score is not None:
        query = query.filter(MMSIAnomalyScore.anomaly_score <= max_score)
    
    total = query.count()
    items = query.order_by(MMSIAnomalyScore.anomaly_score.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "items": [MMSIAnomalyScoreResponse.from_orm(item).dict() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    }


@app.get("/api/anomaly-scores/{mmsi}", response_model=List[MMSIAnomalyScoreResponse])
async def get_anomaly_scores_by_mmsi(
    mmsi: int,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get all anomaly scores for a specific MMSI."""
    items = db.query(MMSIAnomalyScore).filter(
        MMSIAnomalyScore.mmsi == mmsi
    ).order_by(MMSIAnomalyScore.anomaly_score.desc()).limit(limit).all()
    
    return [MMSIAnomalyScoreResponse.from_orm(item) for item in items]


# ==================== MMSI Daily Endpoints ====================

@app.get("/api/mmsi-daily", response_model=PaginatedResponse)
async def get_mmsi_daily(
    mmsi: Optional[int] = Query(None, description="Filter by MMSI"),
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    north: Optional[float] = Query(None, description="Northern boundary"),
    south: Optional[float] = Query(None, description="Southern boundary"),
    east: Optional[float] = Query(None, description="Eastern boundary"),
    west: Optional[float] = Query(None, description="Western boundary"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get daily MMSI data with filtering."""
    query = db.query(MMSIDaily)
    
    if mmsi:
        query = query.filter(MMSIDaily.mmsi == mmsi)
    if start_date:
        query = query.filter(MMSIDaily.date >= start_date)
    if end_date:
        query = query.filter(MMSIDaily.date <= end_date)
    if north is not None:
        query = query.filter(MMSIDaily.cell_ll_lat <= north)
    if south is not None:
        query = query.filter(MMSIDaily.cell_ll_lat >= south)
    if east is not None:
        query = query.filter(MMSIDaily.cell_ll_lon <= east)
    if west is not None:
        query = query.filter(MMSIDaily.cell_ll_lon >= west)
    
    total = query.count()
    items = query.order_by(MMSIDaily.date.desc(), MMSIDaily.mmsi).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "items": [MMSIDailyResponse.from_orm(item).dict() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    }


@app.get("/api/mmsi-daily/{mmsi}", response_model=List[MMSIDailyResponse])
async def get_mmsi_daily_by_mmsi(
    mmsi: int,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
    db: Session = Depends(get_db)
):
    """Get daily data for a specific MMSI."""
    query = db.query(MMSIDaily).filter(MMSIDaily.mmsi == mmsi)
    
    if start_date:
        query = query.filter(MMSIDaily.date >= start_date)
    if end_date:
        query = query.filter(MMSIDaily.date <= end_date)
    
    items = query.order_by(MMSIDaily.date.desc()).limit(limit).all()
    
    return [MMSIDailyResponse.from_orm(item) for item in items]


# ==================== MPA Endpoints ====================

@app.get("/api/mpa", response_model=PaginatedResponse)
async def get_mpa(
    iso3: Optional[str] = Query(None, description="Filter by ISO3 country code"),
    name: Optional[str] = Query(None, description="Search by name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get Marine Protected Areas."""
    query = db.query(MPA)
    
    if iso3:
        query = query.filter(MPA.iso3 == iso3.upper())
    if name:
        query = query.filter(MPA.name.ilike(f"%{name}%"))
    
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "items": [MPAResponse.from_orm(item).dict() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    }


@app.get("/api/mpa/{mpa_id}", response_model=MPAResponse)
async def get_mpa_by_id(
    mpa_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific MPA by ID."""
    mpa = db.query(MPA).filter(MPA.id == mpa_id).first()
    if not mpa:
        raise HTTPException(status_code=404, detail="MPA not found")
    return MPAResponse.from_orm(mpa)


# ==================== EEZ Endpoints ====================

@app.get("/api/eez", response_model=PaginatedResponse)
async def get_eez(
    iso_ter1: Optional[str] = Query(None, description="Filter by ISO territory code"),
    sovereign1: Optional[str] = Query(None, description="Filter by sovereign"),
    geoname: Optional[str] = Query(None, description="Search by geoname"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get Exclusive Economic Zones."""
    query = db.query(EEZ)
    
    if iso_ter1:
        query = query.filter(EEZ.iso_ter1 == iso_ter1.upper())
    if sovereign1:
        query = query.filter(EEZ.sovereign1.ilike(f"%{sovereign1}%"))
    if geoname:
        query = query.filter(EEZ.geoname.ilike(f"%{geoname}%"))
    
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "items": [EEZResponse.from_orm(item).dict() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    }


@app.get("/api/eez/{eez_id}", response_model=EEZResponse)
async def get_eez_by_id(
    eez_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific EEZ by ID."""
    eez = db.query(EEZ).filter(EEZ.id == eez_id).first()
    if not eez:
        raise HTTPException(status_code=404, detail="EEZ not found")
    return EEZResponse.from_orm(eez)


# ==================== EEZ Boundaries Endpoints ====================

@app.get("/api/eez-boundaries", response_model=PaginatedResponse)
async def get_eez_boundaries(
    territory1: Optional[str] = Query(None, description="Filter by territory 1"),
    sovereign1: Optional[str] = Query(None, description="Filter by sovereign 1"),
    line_type: Optional[str] = Query(None, description="Filter by line type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get EEZ boundaries with filtering."""
    query = db.query(EEZBoundaries)
    
    if territory1:
        query = query.filter(EEZBoundaries.territory1.ilike(f"%{territory1}%"))
    if sovereign1:
        query = query.filter(EEZBoundaries.sovereign1.ilike(f"%{sovereign1}%"))
    if line_type:
        query = query.filter(EEZBoundaries.line_type == line_type)
    
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "items": [EEZBoundariesResponse.from_orm(item).dict() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    }


@app.get("/api/eez-boundaries/{line_id}", response_model=EEZBoundariesResponse)
async def get_eez_boundary_by_id(
    line_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific EEZ boundary by line ID."""
    boundary = db.query(EEZBoundaries).filter(EEZBoundaries.line_id == line_id).first()
    if not boundary:
        raise HTTPException(status_code=404, detail="EEZ boundary not found")
    return EEZBoundariesResponse.from_orm(boundary)


@app.get("/api/map/eez-boundaries")
async def get_eez_boundaries_for_map(
    territory1: Optional[str] = Query(None, description="Filter by territory 1"),
    sovereign1: Optional[str] = Query(None, description="Filter by sovereign 1"),
    line_type: Optional[str] = Query(None, description="Filter by line type"),
    limit: int = Query(1000, ge=1, le=5000),
    db: Session = Depends(get_db)
):
    """Get EEZ boundaries data for map display with geometry from shapefile."""
    try:
        import geopandas as gpd
    except ImportError:
        logger.warning("geopandas not available, returning metadata only")
        # Fallback to metadata only
        query = db.query(EEZBoundaries)
        if territory1:
            query = query.filter(EEZBoundaries.territory1.ilike(f"%{territory1}%"))
        if sovereign1:
            query = query.filter(EEZBoundaries.sovereign1.ilike(f"%{sovereign1}%"))
        if line_type:
            query = query.filter(EEZBoundaries.line_type == line_type)
        items = query.limit(limit).all()
        return {
            "items": [{
                "id": item.id,
                "line_id": item.line_id,
                "line_name": item.line_name,
                "line_type": item.line_type,
                "territory1": item.territory1,
                "sovereign1": item.sovereign1,
                "territory2": item.territory2,
                "sovereign2": item.sovereign2,
                "eez1": item.eez1,
                "eez2": item.eez2,
                "length_km": item.length_km,
            } for item in items],
            "total": len(items),
            "geometry_available": False
        }
    
    # Try to load geometry from shapefile
    shapefile_path = Path(__file__).parent.parent.parent / "analysis" / "data" / "World_EEZ_v12_20231025" / "eez_boundaries_v12.shp"
    
    if not shapefile_path.exists():
        logger.warning(f"Shapefile not found at {shapefile_path}, returning metadata only")
        # Fallback to database query
        query = db.query(EEZBoundaries)
        if territory1:
            query = query.filter(EEZBoundaries.territory1.ilike(f"%{territory1}%"))
        if sovereign1:
            query = query.filter(EEZBoundaries.sovereign1.ilike(f"%{sovereign1}%"))
        if line_type:
            query = query.filter(EEZBoundaries.line_type == line_type)
        items = query.limit(limit).all()
        return {
            "items": [{
                "id": item.id,
                "line_id": item.line_id,
                "line_name": item.line_name,
                "line_type": item.line_type,
                "territory1": item.territory1,
                "sovereign1": item.sovereign1,
                "territory2": item.territory2,
                "sovereign2": item.sovereign2,
                "eez1": item.eez1,
                "eez2": item.eez2,
                "length_km": item.length_km,
            } for item in items],
            "total": len(items),
            "geometry_available": False
        }
    
    try:
        # Load shapefile with caching
        global _eez_gdf_cache, _eez_gdf_cache_path
        shapefile_path_str = str(shapefile_path)
        
        # Check if we have a cached version and the file hasn't changed
        if _eez_gdf_cache is None or _eez_gdf_cache_path != shapefile_path_str:
            logger.info("Loading EEZ boundaries shapefile (this may take a moment)...")
            gdf = gpd.read_file(shapefile_path_str)
            gdf = gdf.to_crs(4326)  # Ensure WGS84
            # Simplify geometries for faster rendering (reduce complexity by ~50%)
            # This significantly speeds up GeoJSON conversion and rendering
            try:
                gdf['geometry'] = gdf['geometry'].simplify(tolerance=0.001, preserve_topology=True)
                logger.info("Simplified EEZ boundaries geometries for faster rendering")
            except Exception as simplify_err:
                logger.warning(f"Could not simplify geometries: {simplify_err}, using original")
            
            # Cache the GeoDataFrame
            _eez_gdf_cache = gdf
            _eez_gdf_cache_path = shapefile_path_str
            logger.info(f"Cached EEZ boundaries GeoDataFrame ({len(gdf)} features)")
        else:
            gdf = _eez_gdf_cache
            logger.debug("Using cached EEZ boundaries GeoDataFrame")
        
        # Get metadata from database to filter
        query = db.query(EEZBoundaries)
        if territory1:
            query = query.filter(EEZBoundaries.territory1.ilike(f"%{territory1}%"))
        if sovereign1:
            query = query.filter(EEZBoundaries.sovereign1.ilike(f"%{sovereign1}%"))
        if line_type:
            query = query.filter(EEZBoundaries.line_type == line_type)
        
        db_items = query.limit(limit).all()
        line_ids = [item.line_id for item in db_items if item.line_id is not None]
        
        # Filter shapefile by line_ids
        if line_ids:
            gdf_filtered = gdf[gdf['LINE_ID'].isin(line_ids)]
        else:
            # If no filters, limit to most important boundaries (treaties and median lines)
            # This reduces initial load time
            important_types = ['Treaty', 'Median line', 'Unsettled median line']
            gdf_important = gdf[gdf['LINE_TYPE'].isin(important_types)] if 'LINE_TYPE' in gdf.columns else gdf
            if len(gdf_important) > 0:
                gdf_filtered = gdf_important.head(limit)
            else:
                gdf_filtered = gdf.head(limit)
        
        # Convert to GeoJSON - use to_json() on the entire filtered dataframe for efficiency
        items = []
        if len(gdf_filtered) > 0:
            # Convert entire filtered GeoDataFrame to GeoJSON
            # Remove any date/timestamp columns that might cause serialization issues
            gdf_for_json = gdf_filtered.copy()
            for col in gdf_for_json.columns:
                if col != 'geometry':
                    try:
                        # Check if column is datetime type
                        if pd.api.types.is_datetime64_any_dtype(gdf_for_json[col]):
                            # Convert datetime columns to string
                            gdf_for_json[col] = gdf_for_json[col].astype(str)
                        elif gdf_for_json[col].dtype.name == 'object':
                            # Check if object column contains Timestamp objects
                            sample = gdf_for_json[col].dropna()
                            if len(sample) > 0:
                                first_val = sample.iloc[0]
                                # Check if it's a pandas Timestamp or datetime-like object
                                if isinstance(first_val, pd.Timestamp) or hasattr(first_val, 'isoformat'):
                                    gdf_for_json[col] = gdf_for_json[col].apply(
                                        lambda x: x.isoformat() if pd.notna(x) and hasattr(x, 'isoformat') else x
                                    )
                    except Exception as e:
                        logger.warning(f"Failed to convert column {col} to string: {e}")
                        # If conversion fails, try to drop the column or convert to string anyway
                        try:
                            gdf_for_json[col] = gdf_for_json[col].astype(str)
                        except:
                            # If all else fails, drop the problematic column
                            logger.warning(f"Dropping column {col} due to serialization issues")
                            gdf_for_json = gdf_for_json.drop(columns=[col])
            
            geojson_str = gdf_for_json.to_json()
            geojson_data = json.loads(geojson_str)
            
            # Process each feature
            for feature in geojson_data.get('features', []):
                props = feature.get('properties', {})
                geometry = feature.get('geometry')
                
                # Find matching database item by LINE_ID
                line_id = props.get('LINE_ID')
                db_item = next((item for item in db_items if item.line_id == line_id), None) if line_id else None
                
                items.append({
                    "line_id": int(props.get('LINE_ID', 0)) if props.get('LINE_ID') else None,
                    "line_name": props.get('LINE_NAME') or (db_item.line_name if db_item else None),
                    "line_type": props.get('LINE_TYPE') or (db_item.line_type if db_item else None),
                    "territory1": props.get('TERRITORY1') or (db_item.territory1 if db_item else None),
                    "sovereign1": props.get('SOVEREIGN1') or (db_item.sovereign1 if db_item else None),
                    "territory2": props.get('TERRITORY2') or (db_item.territory2 if db_item else None),
                    "sovereign2": props.get('SOVEREIGN2') or (db_item.sovereign2 if db_item else None),
                    "eez1": props.get('EEZ1') or (db_item.eez1 if db_item else None),
                    "eez2": props.get('EEZ2') or (db_item.eez2 if db_item else None),
                    "length_km": float(props.get('LENGTH_KM', 0)) if props.get('LENGTH_KM') else (db_item.length_km if db_item and db_item.length_km else None),
                    "geometry": geometry  # GeoJSON geometry
                })
        
        return {
            "items": items,
            "total": len(items),
            "geometry_available": True
        }
    except Exception as e:
        logger.error(f"Error loading EEZ boundaries shapefile: {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Fallback to database query
        query = db.query(EEZBoundaries)
        if territory1:
            query = query.filter(EEZBoundaries.territory1.ilike(f"%{territory1}%"))
        if sovereign1:
            query = query.filter(EEZBoundaries.sovereign1.ilike(f"%{sovereign1}%"))
        if line_type:
            query = query.filter(EEZBoundaries.line_type == line_type)
        items = query.limit(limit).all()
        # Convert items to dicts, ensuring all fields are JSON serializable
        items_dict = []
        for item in items:
            item_dict = {
                "id": item.id,
                "line_id": item.line_id,
                "line_name": item.line_name,
                "line_type": item.line_type,
                "territory1": item.territory1,
                "sovereign1": item.sovereign1,
                "territory2": item.territory2,
                "sovereign2": item.sovereign2,
                "eez1": item.eez1,
                "eez2": item.eez2,
                "length_km": float(item.length_km) if item.length_km is not None else None,
            }
            items_dict.append(item_dict)
        return {
            "items": items_dict,
            "total": len(items),
            "geometry_available": False,
            "error": str(e)
        }


@app.get("/api/map/mpa")
async def get_mpa_for_map(
    iso3: Optional[str] = Query(None, description="Filter by ISO3 country code"),
    limit: int = Query(1000, ge=1, le=5000),
    simplify_tolerance: float = Query(0.001, ge=0.0, le=1.0, description="Tolerance for geometry simplification (e.g., 0.001)"),
    db: Session = Depends(get_db)
):
    """Get MPA data for map display with geometry from shapefile."""
    try:
        import geopandas as gpd
    except ImportError:
        logger.warning("geopandas not available, returning metadata only")
        # Fallback to metadata only - optimize query
        try:
            # Only select columns we need
            query = db.query(MPA.wdpaid, MPA.name, MPA.orig_name, MPA.desig_eng, MPA.iucn_cat, MPA.iso3, MPA.gis_m_area, MPA.status)
            if iso3:
                query = query.filter(MPA.iso3 == iso3.upper())
            items = query.limit(limit).all()
            return {
                "items": [{
                    "wdpaid": item.wdpaid,
                    "name": item.name,
                    "orig_name": item.orig_name,
                    "desig_eng": item.desig_eng,
                    "iucn_cat": item.iucn_cat,
                    "iso3": item.iso3,
                    "gis_m_area": float(item.gis_m_area) if item.gis_m_area else None,
                    "status": item.status,
                } for item in items],
                "total": len(items),
                "geometry_available": False
            }
        except Exception as e:
            logger.error(f"Error loading MPA metadata: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Failed to load MPA data: {str(e)}")
        logger.warning("geopandas not available, returning metadata only")
        # Fallback to metadata only
        query = db.query(MPA)
        if iso3:
            query = query.filter(MPA.iso3 == iso3.upper())
        items = query.limit(limit).all()
        return {
            "items": [{
                "id": item.id,
                "wdpaid": item.wdpaid,
                "name": item.name,
                "orig_name": item.orig_name,
                "desig_eng": item.desig_eng,
                "iucn_cat": item.iucn_cat,
                "iso3": item.iso3,
                "gis_m_area": item.gis_m_area,
                "status": item.status,
            } for item in items],
            "total": len(items),
            "geometry_available": False
        }
    
    # Try to load geometry from shapefile
    # MPA shapefiles are split into 3 directories (0, 1, 2)
    base_data_dir = Path(__file__).parent.parent.parent / "analysis" / "data"
    mpa_shapefile_paths = []
    
    # Check all 3 directories for polygon shapefiles
    for dir_num in [0, 1, 2]:
        shapefile_path = base_data_dir / f"WDPA_WDOECM_Oct2025_Public_marine_shp_{dir_num}" / "WDPA_WDOECM_Oct2025_Public_marine_shp-polygons.shp"
        if shapefile_path.exists():
            mpa_shapefile_paths.append(shapefile_path)
            logger.info(f"Found MPA shapefile: {shapefile_path}")
    
    # Find existing shapefile directories
    existing_shapefiles = mpa_shapefile_paths
    
    if not existing_shapefiles:
        logger.warning("MPA shapefiles not found, returning metadata only")
        # Optimize query - only select needed columns
        query = db.query(MPA.wdpaid, MPA.name, MPA.orig_name, MPA.desig_eng, MPA.iucn_cat, MPA.iso3, MPA.gis_m_area, MPA.status)
        if iso3:
            query = query.filter(MPA.iso3 == iso3.upper())
        items = query.limit(limit).all()
        return {
            "items": [{
                "wdpaid": item.wdpaid,
                "name": item.name,
                "orig_name": item.orig_name,
                "desig_eng": item.desig_eng,
                "iucn_cat": item.iucn_cat,
                "iso3": item.iso3,
                "gis_m_area": float(item.gis_m_area) if item.gis_m_area else None,
                "status": item.status,
            } for item in items],
            "total": len(items),
            "geometry_available": False
        }
    
    try:
        # Load and combine all MPA shapefiles with caching
        global _mpa_gdf_cache, _mpa_gdf_cache_paths
        shapefile_paths_str = [str(p) for p in existing_shapefiles]
        
        # Check if we have a cached version and the files haven't changed
        if _mpa_gdf_cache is None or _mpa_gdf_cache_paths != shapefile_paths_str:
            logger.info("Loading MPA shapefiles (this may take a moment)...")
            gdf_list = []
            for shapefile_path in existing_shapefiles:
                logger.info(f"Loading MPA shapefile: {shapefile_path}")
                gdf_part = gpd.read_file(str(shapefile_path))
                gdf_list.append(gdf_part)
            
            if gdf_list:
                logger.info(f"Combining {len(gdf_list)} MPA shapefiles...")
                gdf = gpd.GeoDataFrame(pd.concat(gdf_list, ignore_index=True))
                gdf = gdf.to_crs(4326)  # Ensure WGS84
                # Simplify geometries for faster rendering
                if simplify_tolerance > 0:
                    try:
                        gdf['geometry'] = gdf['geometry'].simplify(tolerance=simplify_tolerance, preserve_topology=True)
                        logger.info(f"Simplified MPA geometries with tolerance {simplify_tolerance}")
                    except Exception as simplify_err:
                        logger.warning(f"Could not simplify MPA geometries: {simplify_err}, using original")
                
                # Cache the GeoDataFrame
                _mpa_gdf_cache = gdf
                _mpa_gdf_cache_paths = shapefile_paths_str
                logger.info(f"Cached MPA GeoDataFrame ({len(gdf)} features)")
            else:
                gdf = gpd.GeoDataFrame()
                _mpa_gdf_cache = gdf
                _mpa_gdf_cache_paths = shapefile_paths_str
        else:
            gdf = _mpa_gdf_cache
            logger.debug("Using cached MPA GeoDataFrame")
        
        # Get metadata from database to filter - optimize query
        query = db.query(MPA.wdpaid, MPA.name, MPA.orig_name, MPA.desig_eng, MPA.iucn_cat, MPA.iso3, MPA.gis_m_area, MPA.status)
        if iso3:
            query = query.filter(MPA.iso3 == iso3.upper())
        
        # Only get the columns we need, limit early
        db_items = query.limit(limit).all()
        wdpaids = [item.wdpaid for item in db_items if item.wdpaid is not None]
        
        # Filter shapefile by WDPAIDs if we have database items
        if len(gdf) > 0:
            if wdpaids and 'WDPAID' in gdf.columns:
                logger.info(f"Filtering MPA by {len(wdpaids)} WDPAIDs from database...")
                gdf_filtered = gdf[gdf['WDPAID'].isin(wdpaids)]
                logger.info(f"Found {len(gdf_filtered)} matching MPAs")
                if len(gdf_filtered) == 0:
                    # If no matches, take a sample for display
                    logger.info("No WDPAID matches, using sample for display")
                    gdf_filtered = gdf.head(min(limit, len(gdf)))
            else:
                # No WDPAIDs to filter by, use limit
                logger.info(f"Using first {limit} MPAs (no WDPAID filter)")
                gdf_filtered = gdf.head(limit)
        else:
            logger.warning("No MPA geometry data available")
            gdf_filtered = gpd.GeoDataFrame()
        
        # Convert to GeoJSON - optimize by processing in batches
        items = []
        if len(gdf_filtered) > 0:
            # Create a lookup dict for faster database item matching
            db_items_dict = {item.wdpaid: item for item in db_items if item.wdpaid is not None}
            
            # Convert to GeoJSON - this is the slow part, so we'll limit if needed
            logger.info(f"Converting {len(gdf_filtered)} MPA features to GeoJSON...")
            geojson_str = gdf_filtered.to_json()
            geojson_data = json.loads(geojson_str)
            
            # Process features with optimized lookup
            for feature in geojson_data.get('features', []):
                props = feature.get('properties', {})
                geometry = feature.get('geometry')
                
                wdpaid = props.get('WDPAID')
                # Use dict lookup instead of next() for O(1) instead of O(n)
                db_item = db_items_dict.get(int(wdpaid)) if wdpaid else None
                
                items.append({
                    "wdpaid": int(wdpaid) if wdpaid else None,
                    "name": props.get('NAME') or (db_item.name if db_item else None),
                    "orig_name": props.get('ORIG_NAME') or (db_item.orig_name if db_item else None),
                    "desig_eng": props.get('DESIG_ENG') or (db_item.desig_eng if db_item else None),
                    "iucn_cat": props.get('IUCN_CAT') or (db_item.iucn_cat if db_item else None),
                    "iso3": props.get('ISO3') or (db_item.iso3 if db_item else None),
                    "gis_m_area": float(props.get('GIS_M_AREA', 0)) if props.get('GIS_M_AREA') else (db_item.gis_m_area if db_item and db_item.gis_m_area else None),
                    "status": props.get('STATUS') or (db_item.status if db_item else None),
                    "geometry": geometry  # GeoJSON geometry
                })
            
            logger.info(f"Processed {len(items)} MPA features")
        
        return {
            "items": items,
            "total": len(items),
            "geometry_available": True
        }
    except Exception as e:
        logger.error(f"Error loading MPA shapefile: {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Fallback to database query - optimize
        query = db.query(MPA.wdpaid, MPA.name, MPA.orig_name, MPA.desig_eng, MPA.iucn_cat, MPA.iso3, MPA.gis_m_area, MPA.status)
        if iso3:
            query = query.filter(MPA.iso3 == iso3.upper())
        items = query.limit(limit).all()
        return {
            "items": [{
                "wdpaid": item.wdpaid,
                "name": item.name,
                "orig_name": item.orig_name,
                "desig_eng": item.desig_eng,
                "iucn_cat": item.iucn_cat,
                "iso3": item.iso3,
                "gis_m_area": float(item.gis_m_area) if item.gis_m_area else None,
                "status": item.status,
            } for item in items],
            "total": len(items),
            "geometry_available": False,
            "error": str(e)
        }


# ==================== Vessel Features Endpoints ====================

@app.get("/api/vessel-features", response_model=PaginatedResponse)
async def get_vessel_features(
    mmsi: Optional[int] = Query(None, description="Filter by MMSI"),
    year: Optional[int] = Query(None, description="Filter by year"),
    is_known_iuu: Optional[bool] = Query(None, description="Filter by IUU status"),
    flag_ais: Optional[str] = Query(None, description="Filter by AIS flag"),
    vessel_class: Optional[str] = Query(None, description="Filter by vessel class (searches inferred, registry, and gfw)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get vessel features with filtering."""
    query = db.query(VesselFeatures)
    
    if mmsi:
        query = query.filter(VesselFeatures.mmsi == mmsi)
    if year:
        query = query.filter(VesselFeatures.year == year)
    if is_known_iuu is not None:
        query = query.filter(VesselFeatures.is_known_iuu == is_known_iuu)
    if flag_ais:
        query = query.filter(VesselFeatures.flag_ais == flag_ais)
    if vessel_class:
        query = query.filter(
            or_(
                VesselFeatures.vessel_class_inferred.ilike(f"%{vessel_class}%"),
                VesselFeatures.vessel_class_registry.ilike(f"%{vessel_class}%"),
                VesselFeatures.vessel_class_gfw.ilike(f"%{vessel_class}%")
            )
        )
    
    total = query.count()
    items = query.order_by(VesselFeatures.year.desc(), VesselFeatures.mmsi).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "items": [VesselFeaturesResponse.from_orm(item).dict() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size
    }


@app.get("/api/vessel-features/{mmsi}", response_model=List[VesselFeaturesResponse])
async def get_vessel_features_by_mmsi(
    mmsi: int,
    year: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get vessel features for a specific MMSI."""
    query = db.query(VesselFeatures).filter(VesselFeatures.mmsi == mmsi)
    
    if year:
        query = query.filter(VesselFeatures.year == year)
    
    items = query.order_by(VesselFeatures.year.desc()).limit(limit).all()
    
    return [VesselFeaturesResponse.from_orm(item) for item in items]


# ==================== Integrated Endpoints (Database + R API) ====================

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics combining database and R API data."""
    # Database stats
    total_vessels = db.query(func.count(func.distinct(VesselFeatures.mmsi))).scalar() or 0
    high_risk_count = db.query(func.count(MMSIAnomalyScore.id)).filter(
        MMSIAnomalyScore.anomaly_score >= 0.75
    ).scalar() or 0
    total_ais_events = db.query(func.count(VesselFeatures.id)).filter(
        VesselFeatures.n_disabling_events > 0
    ).scalar() or 0
    
    # Check R API health
    r_api_health = await r_api_client.health_check()
    r_api_available = r_api_health.get("status") == "ok"
    
    # Log the health check result for debugging
    if not r_api_available:
        logger.warning(f"R API health check failed: {r_api_health.get('message', 'Unknown error')}")
    
    return {
        "total_vessels": total_vessels,
        "high_risk_vessels": high_risk_count,
        "ais_disabling_events": total_ais_events,
        "r_api_status": "connected" if r_api_available else "disconnected",
        "r_api_vessels": r_api_health.get("vessels", 0) if r_api_available else 0,
        "r_api_message": r_api_health.get("message", "") if not r_api_available else None,
    }


@app.get("/api/predictions")
async def get_predictions(
    timeframe: str = Query("all", description="Timeframe filter"),
    riskLevel: Optional[str] = Query(None, description="Risk level filter"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    use_cache: bool = Query(True, description="Use cached predictions if available"),
    db: Session = Depends(get_db)
):
    """Get predictions from database (R API currently disabled).
    
    Results are cached for 5 minutes to improve performance.
    """
    global _predictions_cache, _predictions_cache_time
    
    # Create cache key based on filters and pagination (only cache small initial batches)
    cache_key = f"{timeframe}_{riskLevel or 'all'}_{offset}_{limit}"
    
    try:
        # Only check cache for small initial requests (first page, small limit)
        # This allows fast initial load without caching entire dataset
        is_initial_request = offset == 0 and limit <= 100
        if use_cache and is_initial_request and _predictions_cache is not None and _predictions_cache_time is not None:
            cache_age = (datetime.now() - _predictions_cache_time).total_seconds()
            if cache_age < _predictions_cache_ttl_seconds:
                cached_data = _predictions_cache.get(cache_key)
                if cached_data:
                    logger.info(f"Returning {len(cached_data['items'])} predictions from cache (age: {cache_age:.1f}s)")
                    return {
                        "items": cached_data['items'],
                        "total": cached_data['total'],
                        "page": (offset // limit) + 1,
                        "page_size": limit,
                        "cached": True
                    }
        
        if is_initial_request:
            logger.info(f"Loading initial batch of {limit} predictions...")
        else:
            logger.info(f"Loading predictions page {offset // limit + 1} (offset: {offset}, limit: {limit})...")
        
        # R API is currently disabled due to stability issues
        # Skip R API and use database only
        r_scores = None
        logger.info("R API disabled - using database scores only")
        
        # Always use database fallback (R API disabled)
        if True:  # Changed from "if not r_scores:" to always use database
            # Database-only path (R API disabled)
            # Check cache first
            cache_key_db = f"{cache_key}_db"
            is_initial_request_db = offset == 0 and limit <= 100
            if use_cache and is_initial_request_db and _predictions_cache is not None and _predictions_cache_time is not None:
                cache_age = (datetime.now() - _predictions_cache_time).total_seconds()
                if cache_age < _predictions_cache_ttl_seconds:
                    cached_data = _predictions_cache.get(cache_key_db)
                    if cached_data and cached_data.get('items'):
                        logger.info(f"Returning {len(cached_data['items'])} predictions from cache (DB fallback, age: {cache_age:.1f}s)")
                        return {
                            "items": cached_data['items'],
                            "total": cached_data.get('total', len(cached_data['items'])),
                            "page": (offset // limit) + 1,
                            "page_size": limit,
                            "cached": True
                        }
            
            # Deduplicate by MMSI at the ORM level - get max anomaly_score per MMSI
            subquery = db.query(
                MMSIAnomalyScore.mmsi,
                func.max(MMSIAnomalyScore.anomaly_score).label('max_score')
            ).group_by(MMSIAnomalyScore.mmsi).subquery()
            
            # Join back to get full records with highest scores
            query = db.query(MMSIAnomalyScore).join(
                subquery,
                and_(
                    MMSIAnomalyScore.mmsi == subquery.c.mmsi,
                    MMSIAnomalyScore.anomaly_score == subquery.c.max_score
                )
            ).order_by(MMSIAnomalyScore.anomaly_score.desc())
            
            # Only get the scores for the requested page (not all scores)
            scores = query.offset(offset).limit(limit).all()
            all_items = []
            for score in scores:
                # Get vessel features
                vessel = db.query(VesselFeatures).filter(
                    VesselFeatures.mmsi == score.mmsi
                ).first()
                
                # Get last known position from mmsi_daily
                last_position = None
                last_seen_date = None
                try:
                    last_position = db.query(MMSIDaily).filter(
                        MMSIDaily.mmsi == score.mmsi
                    ).order_by(MMSIDaily.date.desc()).first()
                    
                    if last_position:
                        last_seen_date = last_position.date
                except Exception as e:
                    logger.warning(f"Failed to get last position for MMSI {score.mmsi}: {e}")
                
                risk_level = "low"
                if score.anomaly_score >= 0.9:
                    risk_level = "critical"
                elif score.anomaly_score >= 0.75:
                    risk_level = "high"
                elif score.anomaly_score >= 0.6:
                    risk_level = "medium"
                
                # Extract location data - ensure we always have valid coordinates
                lat = None
                lng = None
                last_seen = None
                if last_position:
                    if last_position.cell_ll_lat is not None and last_position.cell_ll_lon is not None:
                        try:
                            lat = float(last_position.cell_ll_lat) + 0.05
                            lng = float(last_position.cell_ll_lon) + 0.05
                            # Validate coordinates are within valid range
                            if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                                logger.warning(f"Invalid coordinates for MMSI {score.mmsi}: lat={lat}, lng={lng}")
                                lat = None
                                lng = None
                        except (ValueError, TypeError) as e:
                            logger.warning(f"Failed to parse coordinates for MMSI {score.mmsi}: {e}")
                            lat = None
                            lng = None
                    else:
                        logger.debug(f"MMSI {score.mmsi} has position record but missing coordinates")
                    
                    if last_seen_date:
                        if hasattr(last_seen_date, 'isoformat'):
                            last_seen = last_seen_date.isoformat()
                        else:
                            last_seen = str(last_seen_date)
                
                # If no coordinates found, try to get any position for this MMSI (not just the latest)
                if lat is None or lng is None:
                    try:
                        any_position = db.query(MMSIDaily).filter(
                            MMSIDaily.mmsi == score.mmsi,
                            MMSIDaily.cell_ll_lat.isnot(None),
                            MMSIDaily.cell_ll_lon.isnot(None)
                        ).order_by(MMSIDaily.date.desc()).first()
                        
                        if any_position:
                            try:
                                lat = float(any_position.cell_ll_lat) + 0.05
                                lng = float(any_position.cell_ll_lon) + 0.05
                                if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                                    lat = None
                                    lng = None
                            except (ValueError, TypeError):
                                lat = None
                                lng = None
                    except Exception as e:
                        logger.debug(f"Could not find any position for MMSI {score.mmsi}: {e}")
                
                # Extract vessel metadata for easy frontend access
                vessel_features_dict = VesselFeaturesResponse.from_orm(vessel).dict() if vessel else {}
                
                # Build item with all required fields for frontend (both flat and nested)
                item = {
                    "id": str(score.id),
                    "mmsi": str(score.mmsi),
                    "vesselName": f"Vessel {score.mmsi}",  # Frontend expects vesselName
                    "anomaly_score": float(score.anomaly_score),
                    "riskScore": int(float(score.anomaly_score) * 100),  # Frontend expects riskScore
                    "risk_level": risk_level,
                    "confidence": int(min(float(score.anomaly_score) * 100 + 10, 99)),  # Frontend expects confidence
                    "factors": [],  # Will be populated from vessel features
                    "predictedBehavior": f"Anomaly score ({float(score.anomaly_score):.2f}) indicates suspicious activity",
                    "timestamp": last_seen if last_seen else (f"{vessel.year}-01-01" if vessel and vessel.year else "N/A"),
                    "status": "pending",
                    "vessel_features": vessel_features_dict,
                    # Add flat fields for easy frontend access
                    "flag": vessel_features_dict.get("flag_ais") or vessel_features_dict.get("flag_registry") or vessel_features_dict.get("flag_gfw") or "UNK",
                    "vessel_type": vessel_features_dict.get("vessel_class_inferred") or vessel_features_dict.get("vessel_class_registry") or vessel_features_dict.get("vessel_class_gfw") or "Unknown",
                    "tonnage": float(vessel_features_dict.get("tonnage_gt_inferred") or vessel_features_dict.get("tonnage_gt_registry") or vessel_features_dict.get("tonnage_gt_gfw") or 0),
                    "avg_speed": float(vessel_features_dict.get("mean_speed") or 0),
                    "eez_crossings": int(vessel_features_dict.get("eez_crossings") or 0),
                    "time_disabled_hours": float(vessel_features_dict.get("total_disable_hours") or 0),
                    "lat": lat,
                    "lng": lng,
                    "last_seen": last_seen,
                }
                
                # Log if coordinates are missing
                if lat is None or lng is None:
                    logger.debug(f"MMSI {score.mmsi} has no coordinates (no position in mmsi_daily)")
                
                # Add risk factors from vessel features
                if vessel:
                    if vessel.n_disabling_events and vessel.n_disabling_events > 5:
                        item["factors"].append(f"Frequent AIS disabling ({vessel.n_disabling_events} events)")
                    if vessel.eez_crossings and vessel.eez_crossings > 10:
                        item["factors"].append(f"Multiple EEZ crossings ({vessel.eez_crossings})")
                    if vessel.mpa_crossings and vessel.mpa_crossings > 0:
                        item["factors"].append(f"MPA crossings detected ({vessel.mpa_crossings})")
                    if vessel.is_known_iuu:
                        item["factors"].append("Known IUU vessel")
                    if vessel.pct_in_eez and vessel.pct_in_eez > 0.8:
                        item["factors"].append("High percentage of operations in EEZ")
                
                if not item["factors"]:
                    item["factors"] = ["Anomalous behavior pattern detected"]
                
                all_items.append(item)
            
            # Filter by risk level if specified
            if riskLevel and riskLevel != "all":
                all_items = [item for item in all_items if item.get("risk_level") == riskLevel]
            
            # Get total count efficiently
            total_unique = db.query(func.count(func.distinct(MMSIAnomalyScore.mmsi))).scalar()
            
            # Only cache small initial requests
            is_initial_request = offset == 0 and limit <= 100
            if is_initial_request:
                if _predictions_cache is None:
                    _predictions_cache = {}
                _predictions_cache[cache_key_db] = {
                    'items': all_items,
                    'total': total_unique
                }
                _predictions_cache_time = datetime.now()
                logger.info(f"Cached initial batch of {len(all_items)} predictions for key '{cache_key_db}' (DB fallback)")
            
            return {
                "items": all_items,
                "total": total_unique,
                "page": (offset // limit) + 1,
                "page_size": limit,
                "cached": False
            }
        
        # Process R API scores and enrich with database data
        # Use ORM-level deduplication: query database for unique MMSIs with max scores
        subquery = db.query(
            MMSIAnomalyScore.mmsi,
            func.max(MMSIAnomalyScore.anomaly_score).label('max_score')
        ).group_by(MMSIAnomalyScore.mmsi).subquery()
        
        # Get unique MMSIs with their max scores from database (ORM-level deduplication)
        db_unique_query = db.query(
            subquery.c.mmsi,
            subquery.c.max_score.label('anomaly_score')
        ).order_by(subquery.c.max_score.desc())
        
        # If we have R API scores, create a map to override database scores
        r_api_scores_map = {}
        if r_scores:
            for score_data in r_scores:
                mmsi = int(float(score_data.get("mmsi", 0)))
                anomaly_score = float(score_data.get("anomaly_score", 0.0))
                if mmsi > 0:  # Valid MMSI
                    # Keep highest R API score per MMSI
                    if mmsi not in r_api_scores_map or anomaly_score > r_api_scores_map[mmsi]:
                        r_api_scores_map[mmsi] = anomaly_score
        
        # Merge R API scores with database scores efficiently
        # Strategy: If we have R API scores, use them primarily. Otherwise use database.
        final_scores = []
        
        try:
            if r_api_scores_map:
                logger.info(f"Merging {len(r_api_scores_map)} R API scores with database scores")
                # If we have R API scores, use them as primary source
                # Get database scores only for MMSIs not in R API (limited to reasonable number)
                db_scores_limited = db_unique_query.limit(10000).all()  # Limit to prevent memory issues
                db_scores_map = {row.mmsi: float(row.anomaly_score) for row in db_scores_limited}
                logger.info(f"Loaded {len(db_scores_map)} database scores for merging")
                
                # Start with R API scores
                for mmsi, r_score in r_api_scores_map.items():
                    final_scores.append({
                        "mmsi": mmsi,
                        "anomaly_score": r_score
                    })
                
                # Add database scores for MMSIs not in R API (up to a reasonable limit)
                for mmsi, db_score in db_scores_map.items():
                    if mmsi not in r_api_scores_map:
                        final_scores.append({
                            "mmsi": mmsi,
                            "anomaly_score": db_score
                        })
            else:
                logger.info("No R API scores, using database scores only")
                # No R API scores, use database scores with pagination
                # Only get the scores we need for the current page + some buffer
                db_scores_needed = db_unique_query.offset(offset).limit(limit + 100).all()
                logger.info(f"Loaded {len(db_scores_needed)} database scores for page {offset // limit + 1}")
                for row in db_scores_needed:
                    final_scores.append({
                        "mmsi": row.mmsi,
                        "anomaly_score": float(row.anomaly_score)
                    })
            
            logger.info(f"Total final_scores before sorting: {len(final_scores)}")
            
            # Sort by anomaly score descending
            final_scores.sort(key=lambda x: x["anomaly_score"], reverse=True)
            
            # Only build items for the requested page (not all items)
            # This is much faster and doesn't require caching everything
            paginated_scores = final_scores[offset:offset+limit]
            logger.info(f"Paginated to {len(paginated_scores)} scores for page {offset // limit + 1}")
        except Exception as e:
            logger.error(f"Error merging scores: {e}", exc_info=True)
            # Fallback: try to get at least some scores from database
            try:
                db_scores_fallback = db_unique_query.offset(offset).limit(limit).all()
                final_scores = [{"mmsi": row.mmsi, "anomaly_score": float(row.anomaly_score)} for row in db_scores_fallback]
                paginated_scores = final_scores
                logger.warning(f"Using fallback: loaded {len(paginated_scores)} scores from database")
            except Exception as fallback_err:
                logger.error(f"Fallback also failed: {fallback_err}", exc_info=True)
                paginated_scores = []
        
        items = []
        for score_info in paginated_scores:
            mmsi = score_info["mmsi"]
            anomaly_score = score_info["anomaly_score"]
            
            # Get vessel features from database (most recent year)
            vessel = db.query(VesselFeatures).filter(
                VesselFeatures.mmsi == mmsi
            ).order_by(VesselFeatures.year.desc()).first()
            
            # Get last known position from mmsi_daily (most recent date)
            last_position = None
            last_seen_date = None
            try:
                last_position = db.query(MMSIDaily).filter(
                    MMSIDaily.mmsi == mmsi
                ).order_by(MMSIDaily.date.desc()).first()
                
                if last_position:
                    last_seen_date = last_position.date
            except Exception as e:
                logger.warning(f"Failed to get last position for MMSI {mmsi}: {e}")
            
            # Determine risk level
            risk_level = "low"
            if anomaly_score >= 0.9:
                risk_level = "critical"
            elif anomaly_score >= 0.75:
                risk_level = "high"
            elif anomaly_score >= 0.6:
                risk_level = "medium"
            
            # Build factors list from vessel features
            factors = []
            if vessel:
                if vessel.n_disabling_events and vessel.n_disabling_events > 5:
                    factors.append(f"Frequent AIS disabling ({vessel.n_disabling_events} events)")
                if vessel.eez_crossings and vessel.eez_crossings > 10:
                    factors.append(f"Multiple EEZ crossings ({vessel.eez_crossings})")
                if vessel.mpa_crossings and vessel.mpa_crossings > 0:
                    factors.append(f"MPA crossings detected ({vessel.mpa_crossings})")
                if vessel.is_known_iuu:
                    factors.append("Known IUU vessel")
                if vessel.pct_in_eez and vessel.pct_in_eez > 0.8:
                    factors.append("High percentage of operations in EEZ")
            
            # Extract location data
            lat = None
            lng = None
            last_seen = None
            if last_position:
                lat = float(last_position.cell_ll_lat) + 0.05 if last_position.cell_ll_lat is not None else None
                lng = float(last_position.cell_ll_lon) + 0.05 if last_position.cell_ll_lon is not None else None
                if last_seen_date:
                    if hasattr(last_seen_date, 'isoformat'):
                        last_seen = last_seen_date.isoformat()
                    else:
                        last_seen = str(last_seen_date)
            
            # Use real last_seen timestamp, fallback to vessel year if no position data
            if last_seen:
                timestamp = last_seen
            elif vessel and vessel.year:
                timestamp = f"{vessel.year}-01-01"
            else:
                timestamp = "N/A"
            
            item = {
                "id": f"r_{mmsi}",
                "mmsi": str(mmsi),
                "vesselName": f"Vessel {mmsi}",  # Could be enhanced with actual name lookup
                "anomaly_score": anomaly_score,
                "riskScore": int(anomaly_score * 100),
                "risk_level": risk_level,
                "confidence": int(min(anomaly_score * 100 + 10, 99)),  # Approximate confidence
                "factors": factors if factors else ["Anomalous behavior pattern detected"],
                "predictedBehavior": f"High anomaly score ({anomaly_score:.2f}) indicates suspicious activity",
                "timestamp": timestamp,
                "status": "pending",
                "vessel_features": VesselFeaturesResponse.from_orm(vessel).dict() if vessel else None,
                "lat": lat,
                "lng": lng,
                "last_seen": last_seen,
            }
            
            # Filter by risk level if specified
            if riskLevel and riskLevel != "all" and risk_level != riskLevel:
                continue
            
            items.append(item)
        
        # Get total count efficiently (without loading all data)
        total_unique = db.query(func.count(func.distinct(MMSIAnomalyScore.mmsi))).scalar()
        
        # Only cache small initial requests for fast subsequent loads
        is_initial_request = offset == 0 and limit <= 100
        if is_initial_request:
            if _predictions_cache is None:
                _predictions_cache = {}
            _predictions_cache[cache_key] = {
                'items': items,
                'total': total_unique
            }
            _predictions_cache_time = datetime.now()
            logger.info(f"Cached initial batch of {len(items)} predictions for key '{cache_key}'")
        
        return {
            "items": items,
            "total": total_unique,
            "page": (offset // limit) + 1,
            "page_size": limit,
            "cached": False
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting predictions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get predictions: {str(e)}")


@app.get("/api/vessels/{mmsi}")
async def get_vessel_details(mmsi: int, db: Session = Depends(get_db)):
    """Get comprehensive vessel details combining database and R API data."""
    try:
        # Get vessel features from database
        vessel = db.query(VesselFeatures).filter(
            VesselFeatures.mmsi == mmsi
        ).order_by(VesselFeatures.year.desc()).first()
        
        if not vessel:
            raise HTTPException(status_code=404, detail="Vessel not found")
        
        # Get anomaly score from R API (with error handling)
        anomaly_score = None
        r_score = None
        try:
            r_score = await r_api_client.get_score_by_mmsi(mmsi)
            if r_score:
                anomaly_score = float(r_score.get("anomaly_score", 0.0))
        except Exception as e:
            logger.warning(f"Failed to get R API score for MMSI {mmsi}: {e}")
        
        # Fallback to database if R API failed
        if anomaly_score is None:
            db_score = db.query(MMSIAnomalyScore).filter(
                MMSIAnomalyScore.mmsi == mmsi
            ).order_by(MMSIAnomalyScore.anomaly_score.desc()).first()
            if db_score:
                anomaly_score = float(db_score.anomaly_score)
        
        # Determine risk level
        risk_level = "low"
        if anomaly_score is not None:
            if anomaly_score >= 0.9:
                risk_level = "critical"
            elif anomaly_score >= 0.75:
                risk_level = "high"
            elif anomaly_score >= 0.6:
                risk_level = "medium"
        
        # Get most recent date from mmsi_daily for last_seen
        last_seen_date = None
        try:
            last_seen_date = db.query(func.max(MMSIDaily.date)).filter(
                MMSIDaily.mmsi == mmsi
            ).scalar()
        except Exception as e:
            logger.warning(f"Failed to get last_seen_date for MMSI {mmsi}: {e}")
        
        last_seen = None
        if last_seen_date:
            # Handle date conversion properly
            try:
                if isinstance(last_seen_date, date):
                    last_seen = last_seen_date.isoformat()
                elif isinstance(last_seen_date, datetime):
                    last_seen = last_seen_date.isoformat()
                elif isinstance(last_seen_date, str):
                    last_seen = last_seen_date
                else:
                    last_seen = str(last_seen_date)
            except Exception as e:
                logger.warning(f"Failed to convert last_seen_date for MMSI {mmsi}: {e}")
        
        # Get daily positions for trajectory
        daily_positions = []
        try:
            daily_positions = db.query(MMSIDaily).filter(
                MMSIDaily.mmsi == mmsi
            ).order_by(MMSIDaily.date.desc()).limit(100).all()
        except Exception as e:
            logger.warning(f"Failed to get daily positions for MMSI {mmsi}: {e}")
        
        # Build trajectory from daily positions
        trajectory = []
        if daily_positions:
            try:
                for pos in reversed(daily_positions):  # Reverse to get chronological order
                    try:
                        timestamp = pos.date.isoformat() if hasattr(pos.date, 'isoformat') else str(pos.date)
                        trajectory.append({
                            "lat": float(pos.cell_ll_lat) + 0.05 if pos.cell_ll_lat is not None else 0.0,  # Convert to cell center
                            "lng": float(pos.cell_ll_lon) + 0.05 if pos.cell_ll_lon is not None else 0.0,
                            "timestamp": timestamp
                        })
                    except Exception as e:
                        logger.warning(f"Failed to process position for MMSI {mmsi}: {e}")
                        continue
            except Exception as e:
                logger.warning(f"Failed to build trajectory for MMSI {mmsi}: {e}")
        
        # Extract vessel metadata with fallbacks
        try:
            vessel_features_dict = VesselFeaturesResponse.from_orm(vessel).dict()
        except Exception as e:
            logger.error(f"Failed to serialize vessel features for MMSI {mmsi}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to serialize vessel data: {str(e)}")
        
        # Determine best values with fallbacks (prefer inferred, then registry, then gfw)
        flag = vessel_features_dict.get("flag_ais") or vessel_features_dict.get("flag_registry") or vessel_features_dict.get("flag_gfw") or "UNK"
        vessel_type = vessel_features_dict.get("vessel_class_inferred") or vessel_features_dict.get("vessel_class_registry") or vessel_features_dict.get("vessel_class_gfw") or "Unknown"
        tonnage = vessel_features_dict.get("tonnage_gt_inferred") or vessel_features_dict.get("tonnage_gt_registry") or vessel_features_dict.get("tonnage_gt_gfw") or 0.0
        avg_speed = vessel_features_dict.get("mean_speed") or 0.0
        
        # Serialize daily positions safely
        daily_positions_dict = []
        try:
            for pos in daily_positions:
                try:
                    daily_positions_dict.append(MMSIDailyResponse.from_orm(pos).dict())
                except Exception as e:
                    logger.warning(f"Failed to serialize daily position for MMSI {mmsi}: {e}")
                    continue
        except Exception as e:
            logger.warning(f"Failed to serialize daily positions for MMSI {mmsi}: {e}")
        
        return {
            "mmsi": mmsi,
            "vessel_name": f"Vessel {mmsi}",  # VesselFeatures doesn't have name, using MMSI
            "vessel_type": vessel_type,
            "flag": flag,
            "tonnage": float(tonnage) if tonnage else 0.0,
            "avg_speed": float(avg_speed) if avg_speed else 0.0,
            "eez_crossings": int(vessel_features_dict.get("eez_crossings") or 0),
            "time_disabled_hours": float(vessel_features_dict.get("total_disable_hours") or 0.0),
            "anomaly_score": float(anomaly_score) if anomaly_score is not None else None,
            "risk_level": risk_level,
            "last_seen": last_seen or datetime.now().isoformat(),
            "trajectory": trajectory,
            "vessel_features": vessel_features_dict,  # Keep full features for detailed view
            "daily_positions": daily_positions_dict,
            "r_api_available": r_score is not None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting vessel details for MMSI {mmsi}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get vessel details: {str(e)}"
        )


@app.get("/api/analytics/model-performance")
async def get_model_performance(db: Session = Depends(get_db)):
    """Get model performance metrics."""
    # Check R API health
    r_api_health = await r_api_client.health_check()
    r_api_available = r_api_health.get("status") == "ok"
    
    # Get stats from database
    total_vessels = db.query(func.count(func.distinct(VesselFeatures.mmsi))).scalar() or 0
    known_iuu = db.query(func.count(VesselFeatures.id)).filter(
        VesselFeatures.is_known_iuu == True
    ).scalar() or 0
    
    # Calculate approximate metrics (these would be from actual model evaluation)
    # Placeholder values commented out - should be calculated from validation set
    # return {
    #     "accuracy": 94.2,
    #     "precision": 89.7,
    #     "recall": 91.3,
    #     "f1_score": 90.5,
    #     "total_vessels": total_vessels,
    #     "known_iuu_vessels": known_iuu,
    #     "r_api_status": "connected" if r_api_available else "disconnected",
    # }
    
    # Return actual metrics from database (placeholder values removed)
    return {
        "accuracy": None,  # Should be calculated from model evaluation
        "precision": None,  # Should be calculated from model evaluation
        "recall": None,  # Should be calculated from model evaluation
        "f1_score": None,  # Should be calculated from model evaluation
        "total_vessels": total_vessels,
        "known_iuu_vessels": known_iuu,
        "r_api_status": "connected" if r_api_available else "disconnected",
    }


# ==================== Model Training Endpoints ====================

@app.post("/api/model/train")
async def train_model(
    retrain: bool = Query(True, description="Force retrain even if model exists")
):
    """Train/retrain the Isolation Forest model and save latest scores."""
    try:
        result = await r_api_client.train_model(retrain=retrain)
        
        if result.get("status") == "error":
            raise HTTPException(
                status_code=500,
                detail=result.get("message", "Failed to train model")
            )
        
        return {
            "status": "success",
            "message": "Model trained successfully",
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error training model: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to train model: {str(e)}"
        )


# ==================== Statistics Endpoints ====================

@app.get("/api/stats/summary")
async def get_summary_stats(db: Session = Depends(get_db)):
    """Get summary statistics."""
    return {
        "anomaly_scores": {
            "total": db.query(func.count(MMSIAnomalyScore.id)).scalar(),
            "unique_mmsi": db.query(func.count(func.distinct(MMSIAnomalyScore.mmsi))).scalar(),
            "avg_score": db.query(func.avg(MMSIAnomalyScore.anomaly_score)).scalar(),
            "max_score": db.query(func.max(MMSIAnomalyScore.anomaly_score)).scalar(),
            "min_score": db.query(func.min(MMSIAnomalyScore.anomaly_score)).scalar(),
        },
        "mmsi_daily": {
            "total": db.query(func.count(MMSIDaily.id)).scalar(),
            "unique_mmsi": db.query(func.count(func.distinct(MMSIDaily.mmsi))).scalar(),
            "date_range": {
                "min": db.query(func.min(MMSIDaily.date)).scalar(),
                "max": db.query(func.max(MMSIDaily.date)).scalar(),
            }
        },
        "mpa": {
            "total": db.query(func.count(MPA.id)).scalar(),
            "unique_countries": db.query(func.count(func.distinct(MPA.iso3))).scalar(),
        },
        "eez": {
            "total": db.query(func.count(EEZ.id)).scalar(),
            "unique_territories": db.query(func.count(func.distinct(EEZ.iso_ter1))).scalar(),
        },
        "eez_boundaries": {
            "total": db.query(func.count(EEZBoundaries.id)).scalar(),
            "unique_territories": db.query(func.count(func.distinct(EEZBoundaries.territory1))).scalar(),
        },
        "vessel_features": {
            "total": db.query(func.count(VesselFeatures.id)).scalar(),
            "unique_mmsi": db.query(func.count(func.distinct(VesselFeatures.mmsi))).scalar(),
            "year_range": {
                "min": db.query(func.min(VesselFeatures.year)).scalar(),
                "max": db.query(func.max(VesselFeatures.year)).scalar(),
            },
            "iuu_vessels": db.query(func.count(VesselFeatures.id)).filter(VesselFeatures.is_known_iuu == True).scalar(),
        }
    }


# ==================== Cache Management Endpoints ====================

@app.get("/api/cache/info")
async def get_cache_info(cache_type: Optional[str] = None):
    """Get information about cached R API results."""
    from r_api_cache import get_cache_info
    return get_cache_info(cache_type)

@app.post("/api/cache/clear")
async def clear_r_api_cache(
    cache_type: Optional[str] = None,
    older_than_hours: Optional[int] = None
):
    """Clear cached R API results."""
    from r_api_cache import clear_cache
    from datetime import timedelta
    
    older_than = timedelta(hours=older_than_hours) if older_than_hours else None
    cleared = clear_cache(cache_type, older_than)
    
    return {
        "status": "success",
        "cleared_files": cleared,
        "cache_type": cache_type or "all"
    }


# ==================== AIS Events Endpoints ====================

@app.get("/api/map/ais-events")
async def get_ais_events(
    bounds: Optional[BoundsQuery] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get AIS disabling events for map display."""
    try:
        # Get vessels with disabling events from vessel_features
        query = db.query(VesselFeatures).filter(
            VesselFeatures.n_disabling_events > 0
        )
        
        # Apply bounds filter if provided
        if bounds:
            # Note: vessel_features doesn't have lat/lng, so we'd need to join with mmsi_daily
            # For now, just return vessels with disabling events
            pass
        
        vessels = query.limit(limit).all()
        
        # Get recent positions for these vessels from mmsi_daily
        items = []
        for vessel in vessels:
            try:
                # Get most recent position for this vessel
                recent_pos = db.query(MMSIDaily).filter(
                    MMSIDaily.mmsi == vessel.mmsi
                ).order_by(MMSIDaily.date.desc()).first()
                
                if recent_pos:
                    # Calculate average disabling hours per event
                    avg_disable_hours = (vessel.total_disable_hours / vessel.n_disabling_events) if vessel.n_disabling_events > 0 else 0
                    
                    items.append({
                        "id": f"ais_{vessel.mmsi}",
                        "mmsi": str(vessel.mmsi),
                        "lat": float(recent_pos.cell_ll_lat) + 0.05 if recent_pos.cell_ll_lat else 0.0,
                        "lng": float(recent_pos.cell_ll_lon) + 0.05 if recent_pos.cell_ll_lon else 0.0,
                        "duration": float(avg_disable_hours),
                        "startTime": recent_pos.date.isoformat() if hasattr(recent_pos.date, 'isoformat') else str(recent_pos.date),
                        "endTime": recent_pos.date.isoformat() if hasattr(recent_pos.date, 'isoformat') else str(recent_pos.date),
                        "n_events": int(vessel.n_disabling_events) if vessel.n_disabling_events else 0,
                        "total_hours": float(vessel.total_disable_hours) if vessel.total_disable_hours else 0.0,
                    })
            except Exception as e:
                logger.warning(f"Failed to process AIS event for MMSI {vessel.mmsi}: {e}")
                continue
        
        return {
            "items": items,
            "total": len(items)
        }
    except Exception as e:
        logger.error(f"Error getting AIS events: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get AIS events: {str(e)}")


# ==================== Hotspot Analysis Endpoints ====================

@app.get("/api/hotspots/global")
async def get_global_hotspots(
    start_year: int = Query(2017, ge=2010, le=2025),
    end_year: int = Query(2019, ge=2010, le=2025)
):
    """Get global spatial-temporal hotspots."""
    try:
        result = await r_api_client.get_global_hotspots(start_year, end_year)
        if result.get("status") == "error":
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to get global hotspots")
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting global hotspots: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get global hotspots: {str(e)}"
        )


@app.get("/api/hotspots/vessel/{mmsi}")
async def get_vessel_hotspots(
    mmsi: int,
    start_year: int = Query(2017, ge=2010, le=2025),
    end_year: int = Query(2019, ge=2010, le=2025)
):
    """Get individual vessel hotspots."""
    try:
        result = await r_api_client.get_vessel_hotspots(mmsi, start_year, end_year)
        if result.get("status") == "error":
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to get vessel hotspots")
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting vessel hotspots: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get vessel hotspots: {str(e)}"
        )


@app.get("/api/predict/{mmsi}")
async def predict_vessel_location(
    mmsi: str,
    days_ahead: int = Query(5, ge=1, le=30),
    start_year: int = Query(2017, ge=2010, le=2025),
    end_year: int = Query(2019, ge=2010, le=2025)
):
    """Predict vessel location for next N days."""
    try:
        result = await r_api_client.predict_vessel_location(
            mmsi, days_ahead, start_year, end_year
        )
        if result.get("status") == "error":
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to predict vessel location")
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error predicting vessel location: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to predict vessel location: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)

