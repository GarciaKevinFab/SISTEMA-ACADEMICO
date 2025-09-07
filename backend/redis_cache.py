"""
Redis Caching Layer for Sistema Académico
Implements caching for dashboard metrics and static lookups
"""
import redis
import json
import asyncio
from typing import Any, Optional, Dict, List
from datetime import datetime, timedelta
import logging
import os
from functools import wraps
import hashlib

logger = logging.getLogger("api.cache")

# Redis connection
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    redis_client.ping()
    REDIS_AVAILABLE = True
    logger.info("Redis connection established")
except Exception as e:
    logger.warning(f"Redis not available: {e}")
    REDIS_AVAILABLE = False
    redis_client = None

class CacheManager:
    """Manages Redis caching with fallback to in-memory cache"""
    
    def __init__(self):
        self.memory_cache = {}
        self.cache_stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "errors": 0
        }
    
    def _generate_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from prefix and arguments"""
        key_data = {
            "prefix": prefix,
            "args": args,
            "kwargs": {k: v for k, v in kwargs.items() if k not in ['db', 'request', 'current_user']}
        }
        key_string = json.dumps(key_data, sort_keys=True, default=str)
        key_hash = hashlib.md5(key_string.encode()).hexdigest()
        return f"sist_acad:{prefix}:{key_hash}"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache with fallback"""
        try:
            if REDIS_AVAILABLE and redis_client:
                value = redis_client.get(key)
                if value:
                    self.cache_stats["hits"] += 1
                    return json.loads(value)
            
            # Fallback to memory cache
            if key in self.memory_cache:
                cache_item = self.memory_cache[key]
                if cache_item["expires"] > datetime.utcnow():
                    self.cache_stats["hits"] += 1
                    return cache_item["value"]
                else:
                    del self.memory_cache[key]
            
            self.cache_stats["misses"] += 1
            return None
            
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            self.cache_stats["errors"] += 1
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL"""
        try:
            serialized_value = json.dumps(value, default=str)
            
            if REDIS_AVAILABLE and redis_client:
                redis_client.setex(key, ttl, serialized_value)
            
            # Also store in memory cache as fallback
            self.memory_cache[key] = {
                "value": value,
                "expires": datetime.utcnow() + timedelta(seconds=ttl)
            }
            
            self.cache_stats["sets"] += 1
            return True
            
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            self.cache_stats["errors"] += 1
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        try:
            if REDIS_AVAILABLE and redis_client:
                redis_client.delete(key)
            
            if key in self.memory_cache:
                del self.memory_cache[key]
            
            return True
            
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    async def clear_pattern(self, pattern: str) -> int:
        """Clear cache keys matching pattern"""
        try:
            count = 0
            if REDIS_AVAILABLE and redis_client:
                keys = redis_client.keys(pattern)
                if keys:
                    count = redis_client.delete(*keys)
            
            # Clear memory cache
            keys_to_delete = [k for k in self.memory_cache.keys() if pattern.replace("*", "") in k]
            for key in keys_to_delete:
                del self.memory_cache[key]
                count += 1
            
            return count
            
        except Exception as e:
            logger.error(f"Cache clear pattern error: {e}")
            return 0
    
    def get_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        stats = self.cache_stats.copy()
        stats["hit_rate"] = (stats["hits"] / (stats["hits"] + stats["misses"])) * 100 if (stats["hits"] + stats["misses"]) > 0 else 0
        return stats

# Global cache manager instance
cache_manager = CacheManager()

def cached(ttl: int = 300, key_prefix: str = "default"):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = cache_manager._generate_key(key_prefix, func.__name__, *args, **kwargs)
            
            # Try to get from cache
            cached_result = await cache_manager.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {func.__name__}")
                return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache the result
            await cache_manager.set(cache_key, result, ttl)
            logger.debug(f"Cache miss for {func.__name__} - result cached")
            
            return result
        return wrapper
    return decorator

class DashboardCache:
    """Specialized caching for dashboard statistics"""
    
    @staticmethod
    @cached(ttl=60, key_prefix="dashboard")
    async def get_admin_stats(db, user_id: str):
        """Cache admin dashboard stats for 1 minute"""
        from query_optimizer import QueryOptimizer
        return await QueryOptimizer.get_dashboard_stats_optimized(db, "ADMIN", user_id)
    
    @staticmethod
    @cached(ttl=120, key_prefix="dashboard")
    async def get_teacher_stats(db, user_id: str):
        """Cache teacher dashboard stats for 2 minutes"""
        from query_optimizer import QueryOptimizer
        return await QueryOptimizer.get_dashboard_stats_optimized(db, "TEACHER", user_id)
    
    @staticmethod
    @cached(ttl=300, key_prefix="dashboard")
    async def get_student_stats(db, user_id: str):
        """Cache student dashboard stats for 5 minutes"""
        from query_optimizer import QueryOptimizer
        return await QueryOptimizer.get_dashboard_stats_optimized(db, "STUDENT", user_id)

class StaticDataCache:
    """Caching for static/semi-static data"""
    
    @staticmethod
    @cached(ttl=1800, key_prefix="static")  # 30 minutes
    async def get_careers(db, is_active: bool = True):
        """Cache careers data"""
        query = {"is_active": is_active} if is_active else {}
        careers = await db.careers.find(query).to_list(length=None)
        return careers
    
    @staticmethod
    @cached(ttl=900, key_prefix="static")  # 15 minutes
    async def get_study_plans(db, career_id: str):
        """Cache study plans by career"""
        plans = await db.study_plans.find({"career_id": career_id, "is_active": True}).to_list(length=None)
        return plans
    
    @staticmethod
    @cached(ttl=3600, key_prefix="static")  # 1 hour
    async def get_procedure_types(db, area: Optional[str] = None):
        """Cache procedure types"""
        query = {"is_active": True}
        if area:
            query["area"] = area
        types = await db.procedure_types.find(query).to_list(length=None)
        return types
    
    @staticmethod
    async def invalidate_career_cache(career_id: str):
        """Invalidate career-related cache entries"""
        patterns = [
            f"sist_acad:static:*careers*",
            f"sist_acad:static:*study_plans*{career_id}*"
        ]
        for pattern in patterns:
            await cache_manager.clear_pattern(pattern)

class PrecomputedStatsManager:
    """Manages precomputed statistics that are updated periodically"""
    
    @staticmethod
    async def precompute_global_stats(db):
        """Precompute expensive global statistics"""
        stats = {
            "total_students": await db.students.count_documents({"status": {"$ne": "WITHDRAWN"}}),
            "total_courses": await db.courses.count_documents({"is_active": True}),
            "total_teachers": await db.users.count_documents({"role": "TEACHER", "is_active": True}),
            "total_enrollments": await db.enrollments.count_documents({"status": "ACTIVE"}),
            "total_procedures": await db.procedures.count_documents({}),
            "pending_procedures": await db.procedures.count_documents({"status": {"$in": ["RECEIVED", "IN_PROCESS"]}}),
            "total_applications": await db.applications.count_documents({}),
            "active_admission_calls": await db.admission_calls.count_documents({"is_active": True}),
            "computed_at": datetime.utcnow().isoformat()
        }
        
        # Cache for 5 minutes
        await cache_manager.set("sist_acad:precomputed:global_stats", stats, ttl=300)
        logger.info(f"Precomputed global stats: {stats}")
        return stats
    
    @staticmethod
    async def get_precomputed_global_stats():
        """Get precomputed global statistics"""
        return await cache_manager.get("sist_acad:precomputed:global_stats")

# Cache invalidation utilities
class CacheInvalidator:
    """Handles cache invalidation for data changes"""
    
    @staticmethod
    async def invalidate_student_cache(student_id: str):
        """Invalidate student-related cache entries"""
        patterns = [
            f"sist_acad:dashboard:*{student_id}*",
            f"sist_acad:students:*{student_id}*"
        ]
        for pattern in patterns:
            await cache_manager.clear_pattern(pattern)
    
    @staticmethod
    async def invalidate_enrollment_cache(student_id: str, teacher_id: str = None):
        """Invalidate enrollment-related cache entries"""
        patterns = [
            f"sist_acad:dashboard:*{student_id}*",
            f"sist_acad:enrollments:*{student_id}*"
        ]
        if teacher_id:
            patterns.append(f"sist_acad:dashboard:*{teacher_id}*")
        
        for pattern in patterns:
            await cache_manager.clear_pattern(pattern)
    
    @staticmethod
    async def invalidate_procedure_cache(created_by: str, assigned_to: str = None):
        """Invalidate procedure-related cache entries"""
        patterns = [
            f"sist_acad:procedures:*{created_by}*"
        ]
        if assigned_to:
            patterns.append(f"sist_acad:procedures:*{assigned_to}*")
        
        for pattern in patterns:
            await cache_manager.clear_pattern(pattern)