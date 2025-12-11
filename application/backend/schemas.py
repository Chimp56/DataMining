"""Pydantic schemas for API requests and responses."""
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import date


class MMSIAnomalyScoreResponse(BaseModel):
    """Response schema for anomaly scores."""
    id: int
    mmsi: int
    anomaly_score: float
    avg_path: float
    
    class Config:
        from_attributes = True


class MMSIDailyResponse(BaseModel):
    """Response schema for daily MMSI data."""
    id: int
    date: date
    cell_ll_lat: float
    cell_ll_lon: float
    mmsi: int
    hours: float
    fishing_hours: float
    
    class Config:
        from_attributes = True


class MPAResponse(BaseModel):
    """Response schema for MPA data."""
    id: int
    wdpaid: Optional[int]
    name: Optional[str]
    geoname: Optional[str]
    iso3: Optional[str]
    area_km2: Optional[float]
    
    class Config:
        from_attributes = True


class EEZResponse(BaseModel):
    """Response schema for EEZ data."""
    id: int
    mrgid: int
    geoname: Optional[str]
    territory1: Optional[str]
    sovereign1: Optional[str]
    iso_ter1: Optional[str]
    area_km2: Optional[float]
    
    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    """Generic paginated response."""
    items: List[dict]
    total: int
    page: int
    page_size: int
    pages: int


class EEZBoundariesResponse(BaseModel):
    """Response schema for EEZ boundaries data."""
    id: int
    line_id: Optional[int]
    line_name: Optional[str]
    line_type: Optional[str]
    territory1: Optional[str]
    sovereign1: Optional[str]
    territory2: Optional[str]
    sovereign2: Optional[str]
    eez1: Optional[str]
    eez2: Optional[str]
    length_km: Optional[float]
    doc_date: Optional[str] = None  # Date as string to avoid serialization issues
    
    @field_validator('doc_date', mode='before')
    @classmethod
    def convert_date_to_string(cls, v):
        """Convert date objects to strings."""
        if v is None:
            return None
        if isinstance(v, str):
            return v
        if isinstance(v, date):
            return v.isoformat()
        if hasattr(v, 'isoformat'):
            return v.isoformat()
        return str(v)
    
    class Config:
        from_attributes = True
        
    @classmethod
    def from_orm_with_date(cls, obj):
        """Convert ORM object to response, handling date serialization."""
        data = {
            "id": obj.id,
            "line_id": obj.line_id,
            "line_name": obj.line_name,
            "line_type": obj.line_type,
            "territory1": obj.territory1,
            "sovereign1": obj.sovereign1,
            "territory2": obj.territory2,
            "sovereign2": obj.sovereign2,
            "eez1": obj.eez1,
            "eez2": obj.eez2,
            "length_km": obj.length_km,
            "doc_date": None,
        }
        # Handle doc_date if it exists
        if hasattr(obj, 'doc_date') and obj.doc_date:
            if isinstance(obj.doc_date, str):
                data["doc_date"] = obj.doc_date
            elif hasattr(obj.doc_date, 'isoformat'):
                data["doc_date"] = obj.doc_date.isoformat()
            else:
                data["doc_date"] = str(obj.doc_date)
        return cls(**data)


class VesselFeaturesResponse(BaseModel):
    """Response schema for vessel features data."""
    id: int
    mmsi: int
    n_days: Optional[int]
    n_points: Optional[int]
    mean_speed: Optional[float]
    total_fishing_hours: Optional[float]
    pct_in_eez: Optional[float]
    pct_in_mpa: Optional[float]
    mean_dist_eez_km: Optional[float]
    mean_dist_mpa_km: Optional[float]
    eez_crossings: Optional[int]
    mpa_crossings: Optional[int]
    n_disabling_events: Optional[int]
    total_disable_hours: Optional[float]
    max_disable_hours: Optional[float]
    year: Optional[int]
    flag_ais: Optional[str]
    flag_registry: Optional[str]
    flag_gfw: Optional[str]
    vessel_class_inferred: Optional[str]
    vessel_class_inferred_score: Optional[float]
    vessel_class_registry: Optional[str]
    vessel_class_gfw: Optional[str]
    self_reported_fishing_vessel: Optional[bool]
    length_m_inferred: Optional[float]
    length_m_registry: Optional[float]
    length_m_gfw: Optional[float]
    engine_power_kw_inferred: Optional[float]
    engine_power_kw_registry: Optional[float]
    engine_power_kw_gfw: Optional[float]
    tonnage_gt_inferred: Optional[float]
    tonnage_gt_registry: Optional[float]
    tonnage_gt_gfw: Optional[float]
    registries_listed: Optional[str]
    active_hours: Optional[float]
    fishing_hours: Optional[float]
    is_known_iuu: Optional[bool]
    
    class Config:
        from_attributes = True


class BoundsQuery(BaseModel):
    """Query parameters for bounding box."""
    north: Optional[float] = None
    south: Optional[float] = None
    east: Optional[float] = None
    west: Optional[float] = None

