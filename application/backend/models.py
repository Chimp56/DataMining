"""Database models."""
from sqlalchemy import Column, Integer, Float, String, Date, Index, BigInteger, Boolean, TypeDecorator
from sqlalchemy.types import TypeEngine
from datetime import date, datetime
from database import Base


class SQLiteDate(TypeDecorator):
    """Custom date type for SQLite that handles string dates with timestamps."""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        """Convert Python date to string for storage."""
        if value is None:
            return None
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, datetime):
            return value.date().isoformat()
        return str(value)
    
    def process_result_value(self, value, dialect):
        """Convert string from database to Python date."""
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        # Handle string dates - strip timestamp if present
        if isinstance(value, str):
            # Handle formats like '2017-09-20 00:00:00.000000' or '2017-09-20'
            date_str = value.split()[0] if ' ' in value else value
            try:
                return datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                # Try other formats
                try:
                    return datetime.fromisoformat(date_str).date()
                except ValueError:
                    return None
        return None


class MMSIAnomalyScore(Base):
    """Model for MMSI anomaly scores."""
    __tablename__ = "mmsi_anomaly_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(BigInteger, nullable=False, index=True)
    anomaly_score = Column(Float, nullable=False)
    avg_path = Column(Float, nullable=False)
    
    __table_args__ = (
        Index('idx_mmsi_anomaly', 'mmsi', 'anomaly_score'),
    )


class MMSIDaily(Base):
    """Model for MMSI daily data."""
    __tablename__ = "mmsi_daily"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(SQLiteDate, nullable=False, index=True)
    cell_ll_lat = Column(Float, nullable=False)
    cell_ll_lon = Column(Float, nullable=False)
    mmsi = Column(BigInteger, nullable=False, index=True)
    hours = Column(Float, nullable=False)
    fishing_hours = Column(Float, nullable=False)
    
    __table_args__ = (
        Index('idx_mmsi_date', 'mmsi', 'date'),
        Index('idx_location', 'cell_ll_lat', 'cell_ll_lon'),
    )


class MPA(Base):
    """Model for Marine Protected Areas."""
    __tablename__ = "mpa"
    
    id = Column(Integer, primary_key=True, index=True)
    wdpaid = Column(Integer, unique=True, index=True)
    wdpa_pid = Column(Integer)
    pa_def = Column(Integer)
    name = Column(String)
    orig_name = Column(String)
    desig = Column(String)
    desig_eng = Column(String)
    desig_type = Column(String)
    iucn_cat = Column(String)
    int_crit = Column(String)
    marine = Column(Integer)
    rep_m_area = Column(Float)
    gis_m_area = Column(Float)
    rep_area = Column(Float)
    gis_area = Column(Float)
    no_take = Column(String)
    no_tk_area = Column(Float)
    status = Column(String)
    status_yr = Column(Integer)
    gov_type = Column(String)
    own_type = Column(String)
    mang_auth = Column(String)
    mang_plan = Column(String)
    verif = Column(String)
    metadataid = Column(Integer)
    sub_loc = Column(String)
    parent_iso = Column(String)
    iso3 = Column(String, index=True)
    supp_info = Column(String)
    cons_obj = Column(String)


class EEZ(Base):
    """Model for Exclusive Economic Zones."""
    __tablename__ = "eez"
    
    id = Column(Integer, primary_key=True, index=True)
    mrgid = Column(Integer, unique=True, index=True)
    geoname = Column(String, index=True)
    mrgid_ter1 = Column(Integer)
    pol_type = Column(String)
    mrgid_sov1 = Column(Integer)
    territory1 = Column(String)
    iso_ter1 = Column(String, index=True)
    sovereign1 = Column(String)
    mrgid_ter2 = Column(Integer)
    mrgid_sov2 = Column(Integer)
    territory2 = Column(String)
    iso_ter2 = Column(String)
    sovereign2 = Column(String)
    mrgid_ter3 = Column(Integer)
    mrgid_sov3 = Column(Integer)
    territory3 = Column(String)
    iso_ter3 = Column(String)
    sovereign3 = Column(String)
    x_1 = Column(Float)
    y_1 = Column(Float)
    mrgid_eez = Column(Integer)
    area_km2 = Column(Float)
    iso_sov1 = Column(String, index=True)
    iso_sov2 = Column(String)
    iso_sov3 = Column(String)
    un_sov1 = Column(Integer)
    un_sov2 = Column(Integer)
    un_sov3 = Column(Integer)
    un_ter1 = Column(Integer)
    un_ter2 = Column(Integer)
    un_ter3 = Column(Integer)


class EEZBoundaries(Base):
    """Model for EEZ boundaries (lines)."""
    __tablename__ = "eez_boundaries"
    
    id = Column(Integer, primary_key=True, index=True)
    line_id = Column(Integer, unique=True, index=True)
    line_name = Column(String)
    line_type = Column(String)
    mrgid_sov1 = Column(Integer)
    mrgid_ter1 = Column(Integer)
    territory1 = Column(String)
    sovereign1 = Column(String)
    mrgid_ter2 = Column(Integer)
    territory2 = Column(String)
    mrgid_sov2 = Column(Integer)
    sovereign2 = Column(String)
    mrgid_eez1 = Column(Integer)
    eez1 = Column(String)
    mrgid_eez2 = Column(Integer)
    eez2 = Column(String)
    source1 = Column(String)
    url1 = Column(String)
    source2 = Column(String)
    url2 = Column(String)
    source3 = Column(String)
    url3 = Column(String)
    origin = Column(String)
    doc_date = Column(SQLiteDate)
    mrgid_jreg = Column(Integer)
    joint_reg = Column(String)
    length_km = Column(Float)
    mrgid_eez3 = Column(Integer)
    eez3 = Column(String)
    territory3 = Column(String)
    mrgid_ter3 = Column(Integer)
    sovereign3 = Column(String)
    mrgid_sov3 = Column(Integer)
    
    __table_args__ = (
        Index('idx_eez_boundaries_territory', 'territory1', 'territory2'),
    )


class VesselFeatures(Base):
    """Model for vessel features aggregated data."""
    __tablename__ = "vessel_features_all"
    
    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(BigInteger, nullable=False, index=True)
    n_days = Column(Integer)
    n_points = Column(Integer)
    mean_speed = Column(Float)
    total_fishing_hours = Column(Float)
    pct_in_eez = Column(Float)
    pct_in_mpa = Column(Float)
    mean_dist_eez_km = Column(Float)
    mean_dist_mpa_km = Column(Float)
    eez_crossings = Column(Integer)
    mpa_crossings = Column(Integer)
    n_disabling_events = Column(Integer)
    total_disable_hours = Column(Float)
    max_disable_hours = Column(Float)
    year = Column(Integer, index=True)
    flag_ais = Column(String)
    flag_registry = Column(String)
    flag_gfw = Column(String)
    vessel_class_inferred = Column(String)
    vessel_class_inferred_score = Column(Float)
    vessel_class_registry = Column(String)
    vessel_class_gfw = Column(String)
    self_reported_fishing_vessel = Column(Boolean)
    length_m_inferred = Column(Float)
    length_m_registry = Column(Float)
    length_m_gfw = Column(Float)
    engine_power_kw_inferred = Column(Float)
    engine_power_kw_registry = Column(Float)
    engine_power_kw_gfw = Column(Float)
    tonnage_gt_inferred = Column(Float)
    tonnage_gt_registry = Column(Float)
    tonnage_gt_gfw = Column(Float)
    registries_listed = Column(String)
    active_hours = Column(Float)
    fishing_hours = Column(Float)
    is_known_iuu = Column(Boolean, index=True)
    
    __table_args__ = (
        Index('idx_vessel_features_mmsi_year', 'mmsi', 'year'),
        Index('idx_vessel_features_iuu', 'is_known_iuu', 'year'),
    )

