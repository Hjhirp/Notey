import asyncio
import httpx
from typing import Optional, Dict, Any, List
from .config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import logging

logger = logging.getLogger(__name__)

class SupabaseClient:
    """Enhanced Supabase client with retry logic and better error handling"""
    
    def __init__(self, max_retries: int = 3, retry_delay: float = 1.0):
        self.base_url = SUPABASE_URL
        self.api_key = SUPABASE_SERVICE_ROLE_KEY
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        
    def _get_headers(self, user_token: Optional[str] = None) -> Dict[str, str]:
        """Get request headers - use service role key to bypass RLS like database.py"""
        headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        return headers
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, str]] = None,
        user_token: Optional[str] = None,
        prefer: Optional[str] = None
    ) -> httpx.Response:
        """Make HTTP request with retry logic for 429/5xx errors"""
        url = f"{self.base_url}/rest/v1/{endpoint}"
        headers = self._get_headers(user_token)
        
        if prefer:
            headers["Prefer"] = prefer
            
        for attempt in range(self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.request(
                        method=method,
                        url=url,
                        json=data,
                        params=params,
                        headers=headers
                    )
                    
                    # Retry on rate limit or server errors
                    if response.status_code == 429 or response.status_code >= 500:
                        if attempt < self.max_retries:
                            wait_time = self.retry_delay * (2 ** attempt)  # Exponential backoff
                            logger.warning(f"Request failed with {response.status_code}, retrying in {wait_time}s")
                            await asyncio.sleep(wait_time)
                            continue
                    
                    return response
                    
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                if attempt < self.max_retries:
                    wait_time = self.retry_delay * (2 ** attempt)
                    logger.warning(f"Request failed with {type(e).__name__}, retrying in {wait_time}s")
                    await asyncio.sleep(wait_time)
                    continue
                raise
                
        return response  # This should never be reached, but just in case
    
    async def select(
        self,
        table: str,
        columns: str = "*",
        filters: Optional[Dict[str, str]] = None,
        order: Optional[str] = None,
        limit: Optional[int] = None,
        user_token: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Select data from a table with optional filtering"""
        endpoint = table
        params = {"select": columns}
        
        if filters:
            for key, value in filters.items():
                params[key] = value
                
        if order:
            params["order"] = order
            
        if limit:
            params["limit"] = str(limit)
            
        response = await self._make_request(
            method="GET",
            endpoint=endpoint,
            params=params,
            user_token=user_token
        )
        
        response.raise_for_status()
        return response.json()
    
    async def insert(
        self,
        table: str,
        data: Dict[str, Any],
        user_token: Optional[str] = None,
        on_conflict: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Insert data into a table"""
        endpoint = table
        prefer = "return=representation"
        
        if on_conflict:
            prefer += f",resolution={on_conflict}"
            
        response = await self._make_request(
            method="POST",
            endpoint=endpoint,
            data=data,
            user_token=user_token,
            prefer=prefer
        )
        
        response.raise_for_status()
        return response.json()
    
    async def upsert(
        self,
        table: str,
        data: Dict[str, Any],
        user_token: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Upsert data into a table"""
        return await self.insert(
            table=table,
            data=data,
            user_token=user_token,
            on_conflict="merge-duplicates"
        )
    
    async def update(
        self,
        table: str,
        data: Dict[str, Any],
        filters: Dict[str, str],
        user_token: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Update data in a table"""
        endpoint = table
        params = filters
        
        response = await self._make_request(
            method="PATCH",
            endpoint=endpoint,
            data=data,
            params=params,
            user_token=user_token,
            prefer="return=representation"
        )
        
        response.raise_for_status()
        return response.json()
    
    async def delete(
        self,
        table: str,
        filters: Dict[str, str],
        user_token: Optional[str] = None
    ) -> bool:
        """Delete data from a table"""
        endpoint = table
        params = filters
        
        response = await self._make_request(
            method="DELETE",
            endpoint=endpoint,
            params=params,
            user_token=user_token
        )
        
        return response.status_code in [200, 204]

# Global client instance
supabase_client = SupabaseClient()