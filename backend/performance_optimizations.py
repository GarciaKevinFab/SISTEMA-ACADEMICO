"""
Performance Optimizations for Sistema Académico
Implementing caching, connection pooling, and async optimizations
"""
import asyncio
import time
from typing import Dict, Any, Optional, Callable
from functools import wraps
import hashlib
import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("api.performance")

# Simple in-memory cache for demonstration
_cache = {}
_cache_timestamps = {}
_default_ttl = 300  # 5 minutes

class PerformanceCache:
    """Simple in-memory cache with TTL support"""
    
    @staticmethod
    def get_cache_key(func_name: str, args: tuple, kwargs: dict) -> str:
        """Generate cache key from function name and arguments"""
        key_data = {
            'func': func_name,
            'args': args,
            'kwargs': {k: v for k, v in kwargs.items() if k not in ['request', 'current_user']}
        }
        key_string = json.dumps(key_data, sort_keys=True, default=str)
        return hashlib.md5(key_string.encode()).hexdigest()
    
    @staticmethod
    def get(key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        if key not in _cache:
            return None
        
        timestamp = _cache_timestamps.get(key, 0)
        if time.time() - timestamp > _default_ttl:
            # Cache expired, remove it
            _cache.pop(key, None)
            _cache_timestamps.pop(key, None)
            return None
        
        return _cache[key]
    
    @staticmethod
    def set(key: str, value: Any, ttl: int = None) -> None:
        """Set value in cache with TTL"""
        _cache[key] = value
        _cache_timestamps[key] = time.time()
    
    @staticmethod
    def clear() -> None:
        """Clear all cache"""
        _cache.clear()
        _cache_timestamps.clear()

def cache_response(ttl: int = 300):
    """Decorator to cache function responses"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = PerformanceCache.get_cache_key(func.__name__, args, kwargs)
            
            # Try to get from cache first
            cached_result = PerformanceCache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {func.__name__}")
                return cached_result
            
            # Execute function
            start_time = time.time()
            result = await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Cache the result
            PerformanceCache.set(cache_key, result, ttl)
            logger.debug(f"Cache miss for {func.__name__} - executed in {execution_time:.3f}s")
            
            return result
        return wrapper
    return decorator

def performance_monitor(func: Callable):
    """Decorator to monitor function performance"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        
        try:
            result = await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Log slow operations
            if execution_time > 1.0:  # Log operations taking more than 1 second
                logger.warning(f"Slow operation: {func.__name__} took {execution_time:.3f}s")
            elif execution_time > 0.5:  # Log operations taking more than 500ms
                logger.info(f"Performance alert: {func.__name__} took {execution_time:.3f}s")
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Error in {func.__name__} after {execution_time:.3f}s: {str(e)}")
            raise
            
    return wrapper

class DatabaseOptimizations:
    """Database optimization utilities"""
    
    @staticmethod
    async def batch_find(collection, queries: list, limit: int = 100):
        """Batch multiple find operations"""
        tasks = []
        for query in queries:
            task = collection.find(query).limit(limit).to_list(length=limit)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        return results
    
    @staticmethod
    async def optimized_count_documents(collection, queries: dict):
        """Optimize multiple count operations"""
        tasks = []
        for name, query in queries.items():
            task = collection.count_documents(query)
            tasks.append((name, task))
        
        results = {}
        completed_tasks = await asyncio.gather(*[task for _, task in tasks])
        
        for i, (name, _) in enumerate(tasks):
            results[name] = completed_tasks[i]
        
        return results

class ResponseOptimizer:
    """Response optimization utilities"""
    
    @staticmethod
    def compress_response_data(data: Any) -> Any:
        """Optimize response data size"""
        if isinstance(data, dict):
            # Remove None values and empty strings
            return {k: ResponseOptimizer.compress_response_data(v) 
                   for k, v in data.items() 
                   if v is not None and v != ""}
        elif isinstance(data, list):
            return [ResponseOptimizer.compress_response_data(item) for item in data]
        else:
            return data
    
    @staticmethod
    def add_performance_headers(response_data: dict, start_time: float) -> dict:
        """Add performance-related headers to response"""
        execution_time = time.time() - start_time
        
        if isinstance(response_data, dict):
            response_data["_performance"] = {
                "execution_time_ms": round(execution_time * 1000, 2),
                "timestamp": datetime.utcnow().isoformat()
            }
        
        return response_data

async def batch_database_operations(operations: list):
    """Execute multiple database operations in parallel"""
    return await asyncio.gather(*operations, return_exceptions=True)

def create_optimized_pipeline(aggregation_stages: list) -> list:
    """Create optimized MongoDB aggregation pipeline"""
    optimized_pipeline = []
    
    # Add $match early in pipeline to reduce data
    for stage in aggregation_stages:
        if '$match' in stage:
            optimized_pipeline.insert(0, stage)
        else:
            optimized_pipeline.append(stage)
    
    return optimized_pipeline

class PerformanceMetrics:
    """Track and analyze performance metrics"""
    
    def __init__(self):
        self.metrics = {
            'request_count': 0,
            'total_response_time': 0,
            'slow_requests': 0,
            'error_count': 0,
            'cache_hits': 0,
            'cache_misses': 0
        }
    
    def record_request(self, response_time: float, is_error: bool = False):
        """Record request metrics"""
        self.metrics['request_count'] += 1
        self.metrics['total_response_time'] += response_time
        
        if response_time > 1.0:
            self.metrics['slow_requests'] += 1
        
        if is_error:
            self.metrics['error_count'] += 1
    
    def get_average_response_time(self) -> float:
        """Get average response time"""
        if self.metrics['request_count'] == 0:
            return 0.0
        return self.metrics['total_response_time'] / self.metrics['request_count']
    
    def get_error_rate(self) -> float:
        """Get error rate percentage"""
        if self.metrics['request_count'] == 0:
            return 0.0
        return (self.metrics['error_count'] / self.metrics['request_count']) * 100

# Global performance metrics instance
performance_metrics = PerformanceMetrics()