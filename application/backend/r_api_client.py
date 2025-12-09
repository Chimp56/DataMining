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


# Global instance
r_api_client = RAPIClient()

