"""
Fixed Performance Optimizations for Sistema Académico
Implements proper MongoDB connection pooling, caching, and async optimizations
"""
import asyncio
import time
import logging
from typing import Dict, Any, Optional, List
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import json
import hashlib
from functools import wraps
import os

logger = logging.getLogger("api.performance")

class FixedMongoOptimizer:
    """Properly optimized MongoDB client with connection pooling"""
    
    def __init__(self, mongo_url: str, db_name: str):
        self.mongo_url = mongo_url
        self.db_name = db_name
        self._client = None
        self._db = None
    
    def get_client(self) -> AsyncIOMotorClient:
        """Get optimized MongoDB client with proper connection pooling"""
        if self._client is None:
            self._client = AsyncIOMotorClient(
                self.mongo_url,
                maxPoolSize=50,    # Reduced from 100 to prevent connection overflow
                minPoolSize=10,    # Keep minimum connections ready
                maxIdleTimeMS=30000,  # Close idle connections after 30s
                serverSelectionTimeoutMS=5000,  # 5s timeout for server selection
                connectTimeoutMS=10000,  # 10s connection timeout
                socketTimeoutMS=20000,   # 20s socket timeout
                retryWrites=True,
                w="majority",
                compressors="zstd,zlib,snappy"  # Enable compression
            )
            logger.info("Optimized MongoDB client created with connection pooling")
        
        return self._client
    
    def get_database(self):
        """Get database instance"""
        if self._db is None:
            self._db = self.get_client()[self.db_name]
        return self._db

class MemoryCache:
    """Simple in-memory cache for when Redis is not available"""
    
    def __init__(self):
        self._cache = {}
        self._timestamps = {}
        self._stats = {"hits": 0, "misses": 0, "sets": 0}
    
    async def get(self, key: str, ttl: int = 300) -> Optional[Any]:
        """Get value from cache"""
        if key in self._cache:
            timestamp = self._timestamps.get(key, 0)
            if time.time() - timestamp < ttl:
                self._stats["hits"] += 1
                return self._cache[key]
            else:
                # Expired, remove it
                del self._cache[key]
                del self._timestamps[key]
        
        self._stats["misses"] += 1
        return None
    
    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache"""
        self._cache[key] = value
        self._timestamps[key] = time.time()
        self._stats["sets"] += 1
        return True
    
    def get_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = (self._stats["hits"] / total * 100) if total > 0 else 0
        return {**self._stats, "hit_rate": hit_rate}

# Global instances
memory_cache = MemoryCache()

def simple_cache(ttl: int = 300, key_prefix: str = "default"):
    """Simple caching decorator using memory cache"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_data = {
                "func": func.__name__,
                "prefix": key_prefix,
                "args": str(args),
                "kwargs": {k: v for k, v in kwargs.items() if k not in ['db', 'request', 'current_user']}
            }
            cache_key = hashlib.md5(json.dumps(cache_data, sort_keys=True, default=str).encode()).hexdigest()[:16]
            
            # Try cache first
            cached_result = await memory_cache.get(cache_key, ttl)
            if cached_result is not None:
                return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            await memory_cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator

class OptimizedQueries:
    """Optimized database queries to reduce latency"""
    
    @staticmethod
    @simple_cache(ttl=60, key_prefix="dashboard_admin")
    async def get_admin_dashboard_stats(db) -> Dict[str, Any]:
        """Optimized admin dashboard stats with single aggregation"""
        # Use a single aggregation pipeline to get all stats
        pipeline = [
            {
                "$facet": {
                    "students": [
                        {"$match": {"status": "ENROLLED"}},
                        {"$count": "total"}
                    ],
                    "courses": [
                        {"$unionWith": {"coll": "courses"}},
                        {"$match": {"is_active": True}},
                        {"$count": "total"}
                    ],
                    "enrollments": [
                        {"$unionWith": {"coll": "enrollments"}},
                        {"$match": {"status": "ACTIVE"}},
                        {"$count": "total"}
                    ],
                    "procedures": [
                        {"$unionWith": {"coll": "procedures"}},
                        {"$facet": {
                            "total": [{"$count": "count"}],
                            "pending": [
                                {"$match": {"status": {"$in": ["RECEIVED", "IN_PROCESS"]}}},
                                {"$count": "count"}
                            ]
                        }}
                    ]
                }
            }
        ]
        
        try:
            result = await db.students.aggregate(pipeline).to_list(1)
            if result:
                data = result[0]
                return {
                    "total_students": data.get("students", [{}])[0].get("total", 0),
                    "total_courses": data.get("courses", [{}])[0].get("total", 0),
                    "total_enrollments": data.get("enrollments", [{}])[0].get("total", 0),
                    "total_procedures": data.get("procedures", [{}])[0].get("total", [{}])[0].get("count", 0) if data.get("procedures") else 0,
                    "pending_procedures": data.get("procedures", [{}])[0].get("pending", [{}])[0].get("count", 0) if data.get("procedures") else 0
                }
        except Exception as e:
            logger.error(f"Admin dashboard stats error: {e}")
            # Fallback to simple parallel queries
            tasks = [
                db.students.count_documents({"status": "ENROLLED"}),
                db.courses.count_documents({"is_active": True}),
                db.enrollments.count_documents({"status": "ACTIVE"}),
                db.procedures.count_documents({}),
                db.procedures.count_documents({"status": {"$in": ["RECEIVED", "IN_PROCESS"]}})
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            return {
                "total_students": results[0] if not isinstance(results[0], Exception) else 0,
                "total_courses": results[1] if not isinstance(results[1], Exception) else 0,
                "total_enrollments": results[2] if not isinstance(results[2], Exception) else 0,
                "total_procedures": results[3] if not isinstance(results[3], Exception) else 0,
                "pending_procedures": results[4] if not isinstance(results[4], Exception) else 0
            }
        
        return {}
    
    @staticmethod
    @simple_cache(ttl=120, key_prefix="dashboard_teacher")
    async def get_teacher_dashboard_stats(db, teacher_id: str) -> Dict[str, Any]:
        """Optimized teacher dashboard stats"""
        tasks = [
            db.enrollments.count_documents({"teacher_id": teacher_id}),
            db.enrollments.count_documents({
                "teacher_id": teacher_id,
                "grade_status": "INCOMPLETE"
            })
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return {
            "my_courses": results[0] if not isinstance(results[0], Exception) else 0,
            "pending_grades": results[1] if not isinstance(results[1], Exception) else 0
        }
    
    @staticmethod
    @simple_cache(ttl=300, key_prefix="dashboard_student")
    async def get_student_dashboard_stats(db, student_id: str) -> Dict[str, Any]:
        """Optimized student dashboard stats"""
        tasks = [
            db.enrollments.count_documents({"student_id": student_id}),
            db.enrollments.count_documents({
                "student_id": student_id,
                "grade_status": "APPROVED"
            })
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return {
            "my_enrollments": results[0] if not isinstance(results[0], Exception) else 0,
            "approved_courses": results[1] if not isinstance(results[1], Exception) else 0
        }
    
    @staticmethod
    async def get_students_optimized(db, skip: int = 0, limit: int = 50) -> Dict[str, Any]:
        """Optimized students list with projection"""
        # Use projection to reduce data transfer
        projection = {
            "_id": 0,
            "id": 1,
            "student_code": 1,
            "first_name": 1,
            "last_name": 1,
            "program": 1,
            "status": 1,
            "created_at": 1
        }
        
        # Parallel execution of query and count
        tasks = [
            db.students.find(
                {"status": {"$ne": "WITHDRAWN"}}, 
                projection
            ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit),
            db.students.count_documents({"status": {"$ne": "WITHDRAWN"}})
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        students = results[0] if not isinstance(results[0], Exception) else []
        total = results[1] if not isinstance(results[1], Exception) else 0
        
        return {
            "students": students,
            "total": total,
            "skip": skip,
            "limit": limit
        }

class PerformanceTracker:
    """Track performance metrics"""
    
    def __init__(self):
        self.metrics = {
            "request_count": 0,
            "total_response_time": 0,
            "slow_requests": 0,
            "database_queries": 0,
            "error_count": 0
        }
        self.start_time = time.time()
    
    def record_request(self, response_time: float, is_error: bool = False):
        """Record request metrics"""
        self.metrics["request_count"] += 1
        self.metrics["total_response_time"] += response_time
        
        if response_time > 1.0:
            self.metrics["slow_requests"] += 1
        
        if is_error:
            self.metrics["error_count"] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        uptime = time.time() - self.start_time
        avg_response_time = (
            self.metrics["total_response_time"] / self.metrics["request_count"]
            if self.metrics["request_count"] > 0 else 0
        )
        
        return {
            "uptime_seconds": uptime,
            "requests_per_second": self.metrics["request_count"] / uptime if uptime > 0 else 0,
            "average_response_time": avg_response_time,
            "slow_request_percentage": (
                (self.metrics["slow_requests"] / self.metrics["request_count"]) * 100
                if self.metrics["request_count"] > 0 else 0
            ),
            **self.metrics
        }

# Global performance tracker
perf_tracker = PerformanceTracker()

def performance_monitor(func):
    """Performance monitoring decorator"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        
        try:
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time
            perf_tracker.record_request(execution_time, is_error=False)
            
            # Log slow operations
            if execution_time > 1.0:
                logger.warning(f"Slow operation: {func.__name__} took {execution_time:.3f}s")
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            perf_tracker.record_request(execution_time, is_error=True)
            logger.error(f"Error in {func.__name__} after {execution_time:.3f}s: {str(e)}")
            raise
            
    return wrapper