"""Client for R Plumber API (Isolation Forest model)."""
import httpx
from typing import Optional, List, Dict
from config import settings
import logging
from r_api_cache import (
    generate_cache_key, save_to_cache, load_from_cache,
    CACHE_TTL, clear_cache, get_cache_info
)

logger = logging.getLogger(__name__)


class RAPIClient:
    """Client for communicating with R Plumber API."""
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.R_API_URL
        self.timeout = 30.0
    
    async def health_check(self) -> Dict:
        """Check if R API is healthy."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:  # Shorter timeout for health check
                response = await client.get(f"{self.base_url}/health")
                response.raise_for_status()
                data = response.json()
                # Ensure we have a proper status field
                if data.get("status") == "ok":
                    return data
                else:
                    return {"status": "error", "message": data.get("message", "R API returned non-ok status")}
        except httpx.ConnectError as e:
            logger.error(f"R API connection failed (API not running?): {e}")
            return {"status": "error", "message": "R API is not reachable. Is it running?"}
        except httpx.TimeoutException as e:
            logger.error(f"R API health check timed out: {e}")
            return {"status": "error", "message": "R API health check timed out"}
        except httpx.HTTPStatusError as e:
            logger.error(f"R API returned error status {e.response.status_code}: {e}")
            return {"status": "error", "message": f"R API returned status {e.response.status_code}"}
        except Exception as e:
            logger.error(f"R API health check failed: {e}")
            return {"status": "error", "message": f"Health check failed: {str(e)}"}
    
    async def get_top_scores(self, top_n: int = 50, use_cache: bool = True) -> List[Dict]:
        """Get top N anomaly scores from R API."""
        # Check cache first
        if use_cache:
            cache_key = generate_cache_key("top_scores", {"top_n": top_n})
            cached_data = load_from_cache(cache_key, "results", CACHE_TTL["scores"])
            if cached_data is not None:
                logger.info(f"Using cached top scores (top_n={top_n})")
                return cached_data
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/scores",
                    params={"top_n": top_n}
                )
                response.raise_for_status()
                data = response.json()
                # Convert R data.table format to list of dicts
                if isinstance(data, list):
                    result = data
                elif isinstance(data, dict) and "mmsi" in data:
                    # Handle single row case
                    result = [data]
                else:
                    result = []
                
                # Cache the result
                if use_cache and result:
                    cache_key = generate_cache_key("top_scores", {"top_n": top_n})
                    save_to_cache(cache_key, result, "results", CACHE_TTL["scores"])
                
                return result
        except Exception as e:
            logger.error(f"Failed to get top scores from R API: {e}")
            # Try to return cached data even if expired
            if use_cache:
                cache_key = generate_cache_key("top_scores", {"top_n": top_n})
                cached_data = load_from_cache(cache_key, "results", None)  # No TTL check
                if cached_data is not None:
                    logger.warning(f"R API failed, using stale cache for top scores")
                    return cached_data
            return []
    
    async def get_score_by_mmsi(self, mmsi: int, use_cache: bool = True) -> Optional[Dict]:
        """Get anomaly score for a specific MMSI."""
        # Check cache first
        if use_cache:
            cache_key = generate_cache_key("score_mmsi", {"mmsi": mmsi})
            cached_data = load_from_cache(cache_key, "results", CACHE_TTL["scores"])
            if cached_data is not None:
                logger.debug(f"Using cached score for MMSI {mmsi}")
                return cached_data
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/score/{mmsi}")
                response.raise_for_status()
                data = response.json()
                if "error" in data:
                    return None
                
                # Cache the result
                if use_cache:
                    cache_key = generate_cache_key("score_mmsi", {"mmsi": mmsi})
                    save_to_cache(cache_key, data, "results", CACHE_TTL["scores"])
                
                return data
        except Exception as e:
            logger.error(f"Failed to get score for MMSI {mmsi} from R API: {e}")
            # Try to return cached data even if expired
            if use_cache:
                cache_key = generate_cache_key("score_mmsi", {"mmsi": mmsi})
                cached_data = load_from_cache(cache_key, "results", None)  # No TTL check
                if cached_data is not None:
                    logger.warning(f"R API failed, using stale cache for MMSI {mmsi}")
                    return cached_data
            return None
    
    async def train_model(self, retrain: bool = True) -> Dict:
        """Train/retrain the Isolation Forest model and save latest scores."""
        try:
            # Use longer timeout for training (model training can take 1-2 minutes)
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{self.base_url}/train",
                    params={"retrain": "true" if retrain else "false"}
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to train model via R API: {e}")
            return {"status": "error", "message": str(e)}
    
    async def get_global_hotspots(self, start_year: int = 2017, end_year: int = 2019, use_cache: bool = True) -> Dict:
        """Get global spatial-temporal hotspots."""
        # Check cache first
        if use_cache:
            cache_key = generate_cache_key("global_hotspots", {"start_year": start_year, "end_year": end_year})
            cached_data = load_from_cache(cache_key, "hotspots", CACHE_TTL["hotspots"])
            if cached_data is not None:
                logger.info(f"Using cached global hotspots ({start_year}-{end_year})")
                return cached_data
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.get(
                    f"{self.base_url}/hotspots/global",
                    params={"start_year": start_year, "end_year": end_year}
                )
                response.raise_for_status()
                result = response.json()
                
                # Cache successful results
                if use_cache and result.get("status") != "error":
                    cache_key = generate_cache_key("global_hotspots", {"start_year": start_year, "end_year": end_year})
                    save_to_cache(cache_key, result, "hotspots", CACHE_TTL["hotspots"])
                
                return result
        except httpx.HTTPStatusError as e:
            error_detail = "Unknown error"
            try:
                error_data = e.response.json()
                error_detail = error_data.get("error", error_data.get("message", str(e)))
            except:
                error_detail = f"HTTP {e.response.status_code}: {e.response.text[:200]}"
            logger.error(f"R API returned error for global hotspots: {error_detail}")
            # Try cache on error
            if use_cache:
                cache_key = generate_cache_key("global_hotspots", {"start_year": start_year, "end_year": end_year})
                cached_data = load_from_cache(cache_key, "hotspots", None)  # No TTL check
                if cached_data is not None:
                    logger.warning(f"R API failed, using stale cache for global hotspots")
                    return cached_data
            return {"status": "error", "error": error_detail}
        except Exception as e:
            logger.error(f"Failed to get global hotspots from R API: {e}")
            # Try cache on error
            if use_cache:
                cache_key = generate_cache_key("global_hotspots", {"start_year": start_year, "end_year": end_year})
                cached_data = load_from_cache(cache_key, "hotspots", None)  # No TTL check
                if cached_data is not None:
                    logger.warning(f"R API failed, using stale cache for global hotspots")
                    return cached_data
            return {"status": "error", "error": f"R API connection failed: {str(e)}"}
    
    async def get_vessel_hotspots(self, mmsi: int, start_year: int = 2017, end_year: int = 2019, use_cache: bool = True) -> Dict:
        """Get individual vessel hotspots."""
        # Check cache first
        if use_cache:
            cache_key = generate_cache_key("vessel_hotspots", {"mmsi": mmsi, "start_year": start_year, "end_year": end_year})
            cached_data = load_from_cache(cache_key, "hotspots", CACHE_TTL["hotspots"])
            if cached_data is not None:
                logger.info(f"Using cached vessel hotspots for MMSI {mmsi}")
                return cached_data
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.get(
                    f"{self.base_url}/hotspots/vessel/{mmsi}",
                    params={"start_year": start_year, "end_year": end_year}
                )
                response.raise_for_status()
                result = response.json()
                
                # Cache successful results
                if use_cache and result.get("status") != "error":
                    cache_key = generate_cache_key("vessel_hotspots", {"mmsi": mmsi, "start_year": start_year, "end_year": end_year})
                    save_to_cache(cache_key, result, "hotspots", CACHE_TTL["hotspots"])
                
                return result
        except Exception as e:
            logger.error(f"Failed to get vessel hotspots from R API: {e}")
            # Try cache on error
            if use_cache:
                cache_key = generate_cache_key("vessel_hotspots", {"mmsi": mmsi, "start_year": start_year, "end_year": end_year})
                cached_data = load_from_cache(cache_key, "hotspots", None)  # No TTL check
                if cached_data is not None:
                    logger.warning(f"R API failed, using stale cache for vessel hotspots")
                    return cached_data
            return {"status": "error", "message": str(e)}
    
    async def predict_vessel_location(
        self, 
        mmsi: str, 
        days_ahead: int = 5, 
        start_year: int = 2017, 
        end_year: int = 2019,
        use_cache: bool = True
    ) -> Dict:
        """Predict vessel location for next N days."""
        # Check cache first
        if use_cache:
            cache_key = generate_cache_key("vessel_prediction", {
                "mmsi": mmsi, 
                "days_ahead": days_ahead, 
                "start_year": start_year, 
                "end_year": end_year
            })
            cached_data = load_from_cache(cache_key, "predictions", CACHE_TTL["predictions"])
            if cached_data is not None:
                logger.info(f"Using cached prediction for MMSI {mmsi}")
                return cached_data
        
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:  # Longer timeout for model training
                response = await client.get(
                    f"{self.base_url}/predict/{mmsi}",
                    params={
                        "days_ahead": days_ahead,
                        "start_year": start_year,
                        "end_year": end_year
                    }
                )
                response.raise_for_status()
                result = response.json()
                
                # Cache successful results
                if use_cache and result.get("status") != "error":
                    cache_key = generate_cache_key("vessel_prediction", {
                        "mmsi": mmsi, 
                        "days_ahead": days_ahead, 
                        "start_year": start_year, 
                        "end_year": end_year
                    })
                    save_to_cache(cache_key, result, "predictions", CACHE_TTL["predictions"])
                
                return result
        except Exception as e:
            logger.error(f"Failed to predict vessel location from R API: {e}")
            # Try cache on error
            if use_cache:
                cache_key = generate_cache_key("vessel_prediction", {
                    "mmsi": mmsi, 
                    "days_ahead": days_ahead, 
                    "start_year": start_year, 
                    "end_year": end_year
                })
                cached_data = load_from_cache(cache_key, "predictions", None)  # No TTL check
                if cached_data is not None:
                    logger.warning(f"R API failed, using stale cache for vessel prediction")
                    return cached_data
            return {"status": "error", "error": str(e)}


# Global instance
r_api_client = RAPIClient()

