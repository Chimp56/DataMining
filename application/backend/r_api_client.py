"""Client for R Plumber API (Isolation Forest model)."""
import httpx
from typing import Optional, List, Dict
from config import settings
import logging

logger = logging.getLogger(__name__)


class RAPIClient:
    """Client for communicating with R Plumber API."""
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.R_API_URL
        self.timeout = 30.0
    
    async def health_check(self) -> Dict:
        """Check if R API is healthy."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/health")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"R API health check failed: {e}")
            return {"status": "error", "message": str(e)}
    
    async def get_top_scores(self, top_n: int = 50) -> List[Dict]:
        """Get top N anomaly scores from R API."""
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
                    return data
                elif isinstance(data, dict) and "mmsi" in data:
                    # Handle single row case
                    return [data]
                return []
        except Exception as e:
            logger.error(f"Failed to get top scores from R API: {e}")
            return []
    
    async def get_score_by_mmsi(self, mmsi: int) -> Optional[Dict]:
        """Get anomaly score for a specific MMSI."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/score/{mmsi}")
                response.raise_for_status()
                data = response.json()
                if "error" in data:
                    return None
                return data
        except Exception as e:
            logger.error(f"Failed to get score for MMSI {mmsi} from R API: {e}")
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
    
    async def get_global_hotspots(self, start_year: int = 2017, end_year: int = 2019) -> Dict:
        """Get global spatial-temporal hotspots."""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.get(
                    f"{self.base_url}/hotspots/global",
                    params={"start_year": start_year, "end_year": end_year}
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get global hotspots from R API: {e}")
            return {"status": "error", "message": str(e)}
    
    async def get_vessel_hotspots(self, mmsi: int, start_year: int = 2017, end_year: int = 2019) -> Dict:
        """Get individual vessel hotspots."""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.get(
                    f"{self.base_url}/hotspots/vessel/{mmsi}",
                    params={"start_year": start_year, "end_year": end_year}
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get vessel hotspots from R API: {e}")
            return {"status": "error", "message": str(e)}


# Global instance
r_api_client = RAPIClient()

