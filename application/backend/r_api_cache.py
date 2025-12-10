"""Caching utility for R API results and models."""
import json
import pickle
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Cache directory
CACHE_DIR = Path(__file__).parent.parent.parent / "analysis" / "data" / "cache" / "python"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Default TTL (time-to-live) for different cache types
CACHE_TTL = {
    "scores": timedelta(hours=24),  # Anomaly scores cache for 24 hours
    "hotspots": timedelta(hours=12),  # Hotspots cache for 12 hours
    "predictions": timedelta(hours=6),  # Predictions cache for 6 hours
    "models": timedelta(days=7),  # Models cache for 7 days
}


def generate_cache_key(prefix: str, params: Dict[str, Any]) -> str:
    """Generate a cache key from parameters."""
    # Sort params for consistent hashing
    param_str = json.dumps(params, sort_keys=True, default=str)
    param_hash = hashlib.md5(param_str.encode()).hexdigest()
    return f"{prefix}_{param_hash}.json"


def get_cache_path(cache_key: str, cache_type: str = "results") -> Path:
    """Get the full path for a cache file."""
    cache_subdir = CACHE_DIR / cache_type
    cache_subdir.mkdir(parents=True, exist_ok=True)
    return cache_subdir / cache_key


def is_cache_valid(cache_path: Path, ttl: timedelta) -> bool:
    """Check if cache file exists and is still valid."""
    if not cache_path.exists():
        return False
    
    file_age = datetime.now() - datetime.fromtimestamp(cache_path.stat().st_mtime)
    return file_age < ttl


def save_to_cache(cache_key: str, data: Any, cache_type: str = "results", ttl: Optional[timedelta] = None) -> bool:
    """Save data to cache."""
    try:
        cache_path = get_cache_path(cache_key, cache_type)
        
        # Use pickle for complex objects, JSON for simple dicts/lists
        if isinstance(data, (dict, list)) and all(isinstance(x, (str, int, float, bool, type(None), dict, list)) for x in (data.values() if isinstance(data, dict) else data)):
            # JSON-serializable
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump({
                    "data": data,
                    "cached_at": datetime.now().isoformat(),
                    "ttl_hours": ttl.total_seconds() / 3600 if ttl else None
                }, f, indent=2)
        else:
            # Use pickle for complex objects
            with open(cache_path.with_suffix('.pkl'), 'wb') as f:
                pickle.dump({
                    "data": data,
                    "cached_at": datetime.now().isoformat(),
                    "ttl_hours": ttl.total_seconds() / 3600 if ttl else None
                }, f)
        
        logger.debug(f"Cached {cache_type}/{cache_key}")
        return True
    except Exception as e:
        logger.error(f"Failed to save cache {cache_key}: {e}")
        return False


def load_from_cache(cache_key: str, cache_type: str = "results", ttl: Optional[timedelta] = None) -> Optional[Any]:
    """Load data from cache if valid."""
    try:
        cache_path = get_cache_path(cache_key, cache_type)
        
        # Check JSON cache first
        if cache_path.exists():
            if ttl and not is_cache_valid(cache_path, ttl):
                logger.debug(f"Cache expired: {cache_key}")
                return None
            
            with open(cache_path, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
                logger.debug(f"Loaded from cache: {cache_type}/{cache_key}")
                return cached_data.get("data")
        
        # Check pickle cache
        pickle_path = cache_path.with_suffix('.pkl')
        if pickle_path.exists():
            if ttl and not is_cache_valid(pickle_path, ttl):
                logger.debug(f"Cache expired: {cache_key}")
                return None
            
            with open(pickle_path, 'rb') as f:
                cached_data = pickle.load(f)
                logger.debug(f"Loaded from cache (pickle): {cache_type}/{cache_key}")
                return cached_data.get("data")
        
        return None
    except Exception as e:
        logger.warning(f"Failed to load cache {cache_key}: {e}")
        return None


def clear_cache(cache_type: Optional[str] = None, older_than: Optional[timedelta] = None) -> int:
    """Clear cache files. Returns number of files cleared."""
    cleared = 0
    try:
        if cache_type:
            cache_path = CACHE_DIR / cache_type
            if cache_path.exists():
                for file_path in cache_path.glob("*"):
                    if older_than:
                        file_age = datetime.now() - datetime.fromtimestamp(file_path.stat().st_mtime)
                        if file_age < older_than:
                            continue
                    file_path.unlink()
                    cleared += 1
        else:
            # Clear all cache types
            for cache_subdir in CACHE_DIR.iterdir():
                if cache_subdir.is_dir():
                    for file_path in cache_subdir.glob("*"):
                        if older_than:
                            file_age = datetime.now() - datetime.fromtimestamp(file_path.stat().st_mtime)
                            if file_age < older_than:
                                continue
                        file_path.unlink()
                        cleared += 1
        
        logger.info(f"Cleared {cleared} cache files")
        return cleared
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        return cleared


def get_cache_info(cache_type: Optional[str] = None) -> Dict[str, Any]:
    """Get information about cached files."""
    info = {
        "total_files": 0,
        "total_size_mb": 0.0,
        "by_type": {}
    }
    
    try:
        if cache_type:
            cache_path = CACHE_DIR / cache_type
            if cache_path.exists():
                files = list(cache_path.glob("*"))
                info["total_files"] = len(files)
                info["total_size_mb"] = sum(f.stat().st_size for f in files) / (1024 * 1024)
                info["by_type"][cache_type] = {
                    "files": len(files),
                    "size_mb": info["total_size_mb"]
                }
        else:
            # Get info for all cache types
            for cache_subdir in CACHE_DIR.iterdir():
                if cache_subdir.is_dir():
                    files = list(cache_subdir.glob("*"))
                    file_count = len(files)
                    total_size = sum(f.stat().st_size for f in files) / (1024 * 1024)
                    info["total_files"] += file_count
                    info["total_size_mb"] += total_size
                    info["by_type"][cache_subdir.name] = {
                        "files": file_count,
                        "size_mb": round(total_size, 2)
                    }
        
        info["total_size_mb"] = round(info["total_size_mb"], 2)
        return info
    except Exception as e:
        logger.error(f"Failed to get cache info: {e}")
        return info

