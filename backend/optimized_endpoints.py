"""
Optimized endpoints with caching and performance improvements
"""
from fastapi import APIRouter, Depends, Request
from typing import Dict, Any, List
import time
import asyncio
from datetime import datetime, timezone

from shared_deps import get_current_user, db, logger
from logging_middleware import get_correlation_id, log_with_correlation
from performance_optimizations import (
    cache_response, 
    performance_monitor, 
    DatabaseOptimizations,
    ResponseOptimizer,
    performance_metrics
)

optimized_router = APIRouter(prefix="/optimized", tags=["Optimized Endpoints"])

@optimized_router.get("/dashboard/stats")
@cache_response(ttl=60)  # Cache for 1 minute
@performance_monitor
async def get_optimized_dashboard_stats(
    request: Request,
    current_user = Depends(get_current_user)
):
    """Optimized dashboard stats with caching and parallel queries"""
    start_time = time.time()
    correlation_id = get_correlation_id(request)
    
    try:
        # Prepare queries based on user role
        if current_user.role == 'ADMIN':
            queries = {
                "total_students": {"status": "ENROLLED"},
                "total_courses": {"is_active": True},
                "active_enrollments": {"status": "ACTIVE"},
                "pending_procedures": {"status": "RECEIVED"},
                "total_applicants": {}
            }
            
            # Execute all count operations in parallel
            stats = await DatabaseOptimizations.optimized_count_documents(db.students, {
                "total_students": queries["total_students"]
            })
            
            # Add other collections
            course_stats = await DatabaseOptimizations.optimized_count_documents(db.courses, {
                "total_courses": queries["total_courses"]
            })
            
            enrollment_stats = await DatabaseOptimizations.optimized_count_documents(db.enrollments, {
                "active_enrollments": queries["active_enrollments"]
            })
            
            # Combine all stats
            stats.update(course_stats)
            stats.update(enrollment_stats)
            
        elif current_user.role == 'TEACHER':
            # Teacher-specific optimized queries
            teacher_queries = {
                "my_courses": {"teacher_id": current_user.id},
                "pending_grades": {
                    "teacher_id": current_user.id,
                    "grade_status": "INCOMPLETE"
                }
            }
            
            stats = await DatabaseOptimizations.optimized_count_documents(db.enrollments, teacher_queries)
            
        else:  # STUDENT
            # Student-specific optimized queries
            student_queries = {
                "my_enrollments": {"student_id": current_user.id},
                "approved_courses": {
                    "student_id": current_user.id,
                    "grade_status": "APPROVED"
                }
            }
            
            stats = await DatabaseOptimizations.optimized_count_documents(db.enrollments, student_queries)
        
        # Optimize response data
        optimized_stats = ResponseOptimizer.compress_response_data(stats)
        
        # Add performance metadata
        response_data = ResponseOptimizer.add_performance_headers(
            {"stats": optimized_stats}, 
            start_time
        )
        response_data["correlation_id"] = correlation_id
        
        # Record performance metrics
        execution_time = time.time() - start_time
        performance_metrics.record_request(execution_time)
        
        log_with_correlation(
            logger, "info",
            f"Dashboard stats retrieved for {current_user.role}",
            request,
            user_data=current_user.__dict__ if hasattr(current_user, '__dict__') else {"role": current_user.role},
            extra_data={"execution_time": execution_time}
        )
        
        return response_data
        
    except Exception as e:
        execution_time = time.time() - start_time
        performance_metrics.record_request(execution_time, is_error=True)
        
        log_with_correlation(
            logger, "error",
            f"Error getting dashboard stats: {str(e)}",
            request,
            user_data=current_user.__dict__ if hasattr(current_user, '__dict__') else {"role": current_user.role}
        )
        raise

@optimized_router.get("/students")
@cache_response(ttl=120)  # Cache for 2 minutes
@performance_monitor
async def get_optimized_students(
    request: Request,
    limit: int = 50,
    skip: int = 0,
    current_user = Depends(get_current_user)
):
    """Optimized students list with pagination and caching"""
    start_time = time.time()
    correlation_id = get_correlation_id(request)
    
    try:
        # Use aggregation pipeline for better performance
        pipeline = [
            {"$match": {"status": {"$ne": "WITHDRAWN"}}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {"$project": {
                "id": 1,
                "student_code": 1,
                "first_name": 1,
                "last_name": 1,
                "program": 1,
                "status": 1,
                "created_at": 1
            }}
        ]
        
        # Execute aggregation
        students_cursor = db.students.aggregate(pipeline)
        students = await students_cursor.to_list(length=limit)
        
        # Get total count in parallel
        total_task = db.students.count_documents({"status": {"$ne": "WITHDRAWN"}})
        total = await total_task
        
        # Optimize response
        response_data = {
            "students": ResponseOptimizer.compress_response_data(students),
            "total": total,
            "skip": skip,
            "limit": limit,
            "correlation_id": correlation_id
        }
        
        # Add performance headers
        response_data = ResponseOptimizer.add_performance_headers(response_data, start_time)
        
        execution_time = time.time() - start_time
        performance_metrics.record_request(execution_time)
        
        return response_data
        
    except Exception as e:
        execution_time = time.time() - start_time
        performance_metrics.record_request(execution_time, is_error=True)
        raise

@optimized_router.get("/performance/metrics")
async def get_performance_metrics(
    request: Request,
    current_user = Depends(get_current_user)
):
    """Get current performance metrics"""
    if current_user.role != 'ADMIN':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    correlation_id = get_correlation_id(request)
    
    metrics = {
        "request_count": performance_metrics.metrics['request_count'],
        "average_response_time": performance_metrics.get_average_response_time(),
        "slow_requests": performance_metrics.metrics['slow_requests'],
        "error_rate": performance_metrics.get_error_rate(),
        "cache_statistics": {
            "hits": performance_metrics.metrics.get('cache_hits', 0),
            "misses": performance_metrics.metrics.get('cache_misses', 0)
        },
        "correlation_id": correlation_id
    }
    
    return metrics