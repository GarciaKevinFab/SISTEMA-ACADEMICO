"""
FastAPI Performance Optimizations
Implements orjson, gzip, connection pooling, and async optimizations
"""
from fastapi import FastAPI, Request, Response
from fastapi.responses import ORJSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import orjson
import asyncio
import os
import logging
from typing import Any, Dict
import time

logger = logging.getLogger("api.optimization")

class OptimizedFastAPI:
    """Factory for creating optimized FastAPI instance"""
    
    @staticmethod
    def create_app(title: str = "Sistema Académico") -> FastAPI:
        """Create optimized FastAPI application"""
        
        app = FastAPI(
            title=title,
            default_response_class=ORJSONResponse,  # Use orjson for faster JSON serialization
            docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None,
            redoc_url="/redoc" if os.getenv("ENVIRONMENT") != "production" else None
        )
        
        # Add GZip compression middleware
        app.add_middleware(GZipMiddleware, minimum_size=1000)
        
        # Add response optimization middleware
        app.add_middleware(ResponseOptimizationMiddleware)
        
        logger.info("FastAPI app created with performance optimizations")
        return app

class ResponseOptimizationMiddleware:
    """Middleware for response optimization"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request = Request(scope, receive)
            
            async def send_wrapper(message):
                if message["type"] == "http.response.start":
                    headers = list(message.get("headers", []))
                    
                    # Add performance headers
                    headers.append([b"x-content-type-options", b"nosniff"])
                    headers.append([b"x-frame-options", b"DENY"])
                    headers.append([b"x-xss-protection", b"1; mode=block"])
                    
                    # Add caching headers for static content
                    if request.url.path.endswith(('.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico')):
                        headers.append([b"cache-control", b"public, max-age=31536000"])  # 1 year
                    elif "api" in request.url.path and request.method == "GET":
                        headers.append([b"cache-control", b"public, max-age=60"])  # 1 minute for API
                    
                    message["headers"] = headers
                
                await send(message)
            
            await self.app(scope, receive, send_wrapper)
        else:
            await self.app(scope, receive, send)

class OptimizedMongoClient:
    """Optimized MongoDB client with connection pooling"""
    
    def __init__(self, mongo_url: str, db_name: str):
        self.mongo_url = mongo_url
        self.db_name = db_name
        self._client = None
        self._db = None
    
    def get_client(self) -> AsyncIOMotorClient:
        """Get optimized MongoDB client with connection pooling"""
        if self._client is None:
            self._client = AsyncIOMotorClient(
                self.mongo_url,
                maxPoolSize=20,  # Maximum connections in pool
                minPoolSize=5,   # Minimum connections in pool
                maxIdleTimeMS=30000,  # Close connections after 30s idle
                serverSelectionTimeoutMS=5000,  # 5s timeout for server selection
                connectTimeoutMS=10000,  # 10s connection timeout
                socketTimeoutMS=20000,   # 20s socket timeout
                retryWrites=True,
                w="majority"
            )
            logger.info("Optimized MongoDB client created with connection pooling")
        
        return self._client
    
    def get_database(self):
        """Get database instance"""
        if self._db is None:
            self._db = self.get_client()[self.db_name]
        return self._db
    
    async def close(self):
        """Close MongoDB connection"""
        if self._client:
            self._client.close()
            logger.info("MongoDB client closed")

class AsyncOptimizer:
    """Utilities for async optimization"""
    
    @staticmethod
    async def gather_with_limit(tasks, limit: int = 10):
        """Execute tasks with concurrency limit to prevent overwhelming"""
        semaphore = asyncio.Semaphore(limit)
        
        async def limited_task(task):
            async with semaphore:
                return await task
        
        limited_tasks = [limited_task(task) for task in tasks]
        return await asyncio.gather(*limited_tasks, return_exceptions=True)
    
    @staticmethod
    async def batch_process(items, batch_size: int = 100, processor_func=None):
        """Process items in batches to optimize memory usage"""
        results = []
        
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            
            if processor_func:
                batch_results = await processor_func(batch)
                results.extend(batch_results)
            else:
                results.extend(batch)
        
        return results
    
    @staticmethod
    def optimize_aggregation_pipeline(pipeline: list) -> list:
        """Optimize MongoDB aggregation pipeline for better performance"""
        optimized = []
        match_stages = []
        other_stages = []
        
        # Separate $match stages from others
        for stage in pipeline:
            if "$match" in stage:
                match_stages.append(stage)
            else:
                other_stages.append(stage)
        
        # Add $match stages first (most selective first if possible)
        optimized.extend(match_stages)
        
        # Add $sort before $skip and $limit if present
        sort_stage = None
        skip_stage = None
        limit_stage = None
        remaining_stages = []
        
        for stage in other_stages:
            if "$sort" in stage:
                sort_stage = stage
            elif "$skip" in stage:
                skip_stage = stage
            elif "$limit" in stage:
                limit_stage = stage
            else:
                remaining_stages.append(stage)
        
        # Add stages in optimal order
        optimized.extend(remaining_stages)
        
        if sort_stage:
            optimized.append(sort_stage)
        if skip_stage:
            optimized.append(skip_stage)
        if limit_stage:
            optimized.append(limit_stage)
        
        return optimized

class PerformanceMonitor:
    """Monitor and track performance metrics"""
    
    def __init__(self):
        self.metrics = {
            "request_count": 0,
            "total_response_time": 0,
            "slow_requests": 0,
            "database_queries": 0,
            "cache_hits": 0,
            "cache_misses": 0
        }
        self.reset_time = time.time()
    
    def record_request(self, response_time: float):
        """Record request metrics"""
        self.metrics["request_count"] += 1
        self.metrics["total_response_time"] += response_time
        
        if response_time > 1.0:  # Slow request threshold
            self.metrics["slow_requests"] += 1
    
    def record_database_query(self):
        """Record database query"""
        self.metrics["database_queries"] += 1
    
    def record_cache_hit(self):
        """Record cache hit"""
        self.metrics["cache_hits"] += 1
    
    def record_cache_miss(self):
        """Record cache miss"""
        self.metrics["cache_misses"] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        elapsed_time = time.time() - self.reset_time
        
        return {
            "uptime_seconds": elapsed_time,
            "requests_per_second": self.metrics["request_count"] / elapsed_time if elapsed_time > 0 else 0,
            "average_response_time": (
                self.metrics["total_response_time"] / self.metrics["request_count"]
                if self.metrics["request_count"] > 0 else 0
            ),
            "slow_request_percentage": (
                (self.metrics["slow_requests"] / self.metrics["request_count"]) * 100
                if self.metrics["request_count"] > 0 else 0
            ),
            "cache_hit_rate": (
                (self.metrics["cache_hits"] / (self.metrics["cache_hits"] + self.metrics["cache_misses"])) * 100
                if (self.metrics["cache_hits"] + self.metrics["cache_misses"]) > 0 else 0
            ),
            **self.metrics
        }
    
    def reset_stats(self):
        """Reset statistics"""
        self.metrics = {key: 0 for key in self.metrics}
        self.reset_time = time.time()

# Global performance monitor
performance_monitor = PerformanceMonitor()

class ResponseCompressor:
    """Compress response data to reduce bandwidth"""
    
    @staticmethod
    def compress_dict(data: dict, remove_nulls: bool = True, max_depth: int = 10) -> dict:
        """Compress dictionary by removing nulls and empty values"""
        if max_depth <= 0:
            return data
        
        if not isinstance(data, dict):
            return data
        
        compressed = {}
        for key, value in data.items():
            if remove_nulls and (value is None or value == "" or value == []):
                continue
            
            if isinstance(value, dict):
                compressed_value = ResponseCompressor.compress_dict(value, remove_nulls, max_depth - 1)
                if compressed_value:  # Only add non-empty dicts
                    compressed[key] = compressed_value
            elif isinstance(value, list) and value:
                compressed_list = []
                for item in value:
                    if isinstance(item, dict):
                        compressed_item = ResponseCompressor.compress_dict(item, remove_nulls, max_depth - 1)
                        if compressed_item:
                            compressed_list.append(compressed_item)
                    else:
                        compressed_list.append(item)
                
                if compressed_list:
                    compressed[key] = compressed_list
            else:
                compressed[key] = value
        
        return compressed
    
    @staticmethod
    def optimize_list_response(items: list, fields: list = None) -> list:
        """Optimize list response by selecting only required fields"""
        if not items or not fields:
            return items
        
        optimized = []
        for item in items:
            if isinstance(item, dict):
                optimized_item = {field: item.get(field) for field in fields if field in item}
                optimized.append(optimized_item)
            else:
                optimized.append(item)
        
        return optimized

# Uvicorn optimization configuration
def get_uvicorn_config():
    """Get optimized uvicorn configuration"""
    import multiprocessing
    
    # Calculate optimal worker count
    cpu_count = multiprocessing.cpu_count()
    worker_count = min(max(2, cpu_count), 4)  # Between 2-4 workers
    
    return {
        "host": "0.0.0.0",
        "port": 8001,
        "workers": worker_count,
        "worker_class": "uvicorn.workers.UvicornWorker",
        "keep_alive": 65,  # Keep connections alive
        "max_requests": 1000,  # Restart worker after 1000 requests
        "max_requests_jitter": 100,  # Add jitter to prevent thundering herd
        "preload_app": True,  # Preload app for better performance
        "timeout": 30,  # Request timeout
        "limit_max_requests": 1000,  # Max concurrent requests
        "backlog": 2048,  # Connection backlog
        "access_log": False,  # Disable access logs for performance
        "use_colors": False
    }