"""
Query Optimizer for Sistema Académico
Eliminates N+1 queries and reduces payload with projections and aggregations
"""
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorCollection
import asyncio
from datetime import datetime, timezone

class QueryOptimizer:
    """Optimizes database queries to eliminate N+1 problems and reduce payload"""
    
    @staticmethod
    async def get_students_with_enrollments_optimized(
        db, 
        filter_query: Dict = None, 
        skip: int = 0, 
        limit: int = 50
    ) -> Dict[str, Any]:
        """Optimized student list with enrollment counts using aggregation"""
        
        match_stage = {"$match": filter_query or {"status": {"$ne": "WITHDRAWN"}}}
        
        pipeline = [
            match_stage,
            {
                "$lookup": {
                    "from": "enrollments",
                    "localField": "id",
                    "foreignField": "student_id",
                    "as": "enrollments"
                }
            },
            {
                "$addFields": {
                    "enrollment_count": {"$size": "$enrollments"},
                    "active_enrollments": {
                        "$size": {
                            "$filter": {
                                "input": "$enrollments",
                                "cond": {"$eq": ["$$this.status", "ACTIVE"]}
                            }
                        }
                    }
                }
            },
            {
                "$project": {
                    "id": 1,
                    "student_code": 1,
                    "first_name": 1,
                    "last_name": 1,
                    "second_last_name": 1,
                    "program": 1,
                    "status": 1,
                    "entry_year": 1,
                    "enrollment_count": 1,
                    "active_enrollments": 1,
                    "created_at": 1
                }
            },
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        students_cursor = db.students.aggregate(pipeline)
        students = await students_cursor.to_list(length=limit)
        
        # Get total count in parallel
        count_pipeline = [match_stage, {"$count": "total"}]
        count_result = await db.students.aggregate(count_pipeline).to_list(1)
        total = count_result[0]["total"] if count_result else 0
        
        return {
            "students": students,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    @staticmethod
    async def get_courses_with_enrollments_optimized(
        db,
        career_id: Optional[str] = None,
        semester: Optional[int] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Dict[str, Any]:
        """Optimized course list with enrollment statistics"""
        
        match_stage = {"$match": {"is_active": True}}
        if career_id:
            match_stage["$match"]["career_id"] = career_id
        if semester:
            match_stage["$match"]["semester"] = semester
        
        pipeline = [
            match_stage,
            {
                "$lookup": {
                    "from": "enrollments",
                    "localField": "id",
                    "foreignField": "course_id",
                    "as": "enrollments"
                }
            },
            {
                "$lookup": {
                    "from": "careers",
                    "localField": "career_id",
                    "foreignField": "id",
                    "as": "career_info"
                }
            },
            {
                "$addFields": {
                    "total_enrollments": {"$size": "$enrollments"},
                    "active_enrollments": {
                        "$size": {
                            "$filter": {
                                "input": "$enrollments",
                                "cond": {"$eq": ["$$this.status", "ACTIVE"]}
                            }
                        }
                    },
                    "career_name": {"$arrayElemAt": ["$career_info.name", 0]}
                }
            },
            {
                "$project": {
                    "id": 1,
                    "code": 1,
                    "name": 1,
                    "credits": 1,
                    "semester": 1,
                    "career_name": 1,
                    "total_enrollments": 1,
                    "active_enrollments": 1,
                    "prerequisite_ids": 1,
                    "is_active": 1
                }
            },
            {"$sort": {"semester": 1, "name": 1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        courses_cursor = db.courses.aggregate(pipeline)
        courses = await courses_cursor.to_list(length=limit)
        
        # Get total count
        count_pipeline = [match_stage, {"$count": "total"}]
        count_result = await db.courses.aggregate(count_pipeline).to_list(1)
        total = count_result[0]["total"] if count_result else 0
        
        return {
            "courses": courses,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    @staticmethod
    async def get_enrollments_with_details_optimized(
        db,
        student_id: Optional[str] = None,
        teacher_id: Optional[str] = None,
        academic_year: Optional[int] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Dict[str, Any]:
        """Optimized enrollment list with student and course details"""
        
        match_conditions = {"status": "ACTIVE"}
        if student_id:
            match_conditions["student_id"] = student_id
        if teacher_id:
            match_conditions["teacher_id"] = teacher_id
        if academic_year:
            match_conditions["academic_year"] = academic_year
        
        pipeline = [
            {"$match": match_conditions},
            {
                "$lookup": {
                    "from": "students",
                    "localField": "student_id",
                    "foreignField": "id",
                    "as": "student_info"
                }
            },
            {
                "$lookup": {
                    "from": "courses",
                    "localField": "course_id",
                    "foreignField": "id",
                    "as": "course_info"
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "teacher_id",
                    "foreignField": "id",
                    "as": "teacher_info"
                }
            },
            {
                "$addFields": {
                    "student_name": {
                        "$concat": [
                            {"$arrayElemAt": ["$student_info.first_name", 0]},
                            " ",
                            {"$arrayElemAt": ["$student_info.last_name", 0]}
                        ]
                    },
                    "student_code": {"$arrayElemAt": ["$student_info.student_code", 0]},
                    "course_name": {"$arrayElemAt": ["$course_info.name", 0]},
                    "course_code": {"$arrayElemAt": ["$course_info.code", 0]},
                    "course_credits": {"$arrayElemAt": ["$course_info.credits", 0]},
                    "teacher_name": {"$arrayElemAt": ["$teacher_info.full_name", 0]}
                }
            },
            {
                "$project": {
                    "id": 1,
                    "student_id": 1,
                    "course_id": 1,
                    "student_name": 1,
                    "student_code": 1,
                    "course_name": 1,
                    "course_code": 1,
                    "course_credits": 1,
                    "teacher_name": 1,
                    "academic_year": 1,
                    "academic_period": 1,
                    "numerical_grade": 1,
                    "literal_grade": 1,
                    "grade_status": 1,
                    "attendance_percentage": 1,
                    "enrollment_date": 1
                }
            },
            {"$sort": {"enrollment_date": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        enrollments_cursor = db.enrollments.aggregate(pipeline)
        enrollments = await enrollments_cursor.to_list(length=limit)
        
        # Get total count
        count_pipeline = [{"$match": match_conditions}, {"$count": "total"}]
        count_result = await db.enrollments.aggregate(count_pipeline).to_list(1)
        total = count_result[0]["total"] if count_result else 0
        
        return {
            "enrollments": enrollments,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    @staticmethod
    async def get_procedures_with_details_optimized(
        db,
        status: Optional[str] = None,
        area: Optional[str] = None,
        created_by: Optional[str] = None,
        assigned_to: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Dict[str, Any]:
        """Optimized procedures list with creator and assignee details"""
        
        match_conditions = {}
        if status:
            match_conditions["status"] = status
        if area:
            match_conditions["area"] = area
        if created_by:
            match_conditions["created_by"] = created_by
        if assigned_to:
            match_conditions["assigned_to"] = assigned_to
        
        pipeline = [
            {"$match": match_conditions} if match_conditions else {"$match": {}},
            {
                "$lookup": {
                    "from": "procedure_types",
                    "localField": "procedure_type_id",
                    "foreignField": "id",
                    "as": "procedure_type_info"
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "created_by",
                    "foreignField": "id",
                    "as": "creator_info"
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "assigned_to",
                    "foreignField": "id",
                    "as": "assignee_info"
                }
            },
            {
                "$addFields": {
                    "procedure_type_name": {"$arrayElemAt": ["$procedure_type_info.name", 0]},
                    "creator_name": {"$arrayElemAt": ["$creator_info.full_name", 0]},
                    "assignee_name": {"$arrayElemAt": ["$assignee_info.full_name", 0]}
                }
            },
            {
                "$project": {
                    "id": 1,
                    "tracking_code": 1,
                    "subject": 1,
                    "status": 1,
                    "priority": 1,
                    "area": 1,
                    "procedure_type_name": 1,
                    "creator_name": 1,
                    "assignee_name": 1,
                    "applicant_name": 1,
                    "created_at": 1,
                    "updated_at": 1,
                    "deadline": 1
                }
            },
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        procedures_cursor = db.procedures.aggregate(pipeline)
        procedures = await procedures_cursor.to_list(length=limit)
        
        # Get total count
        count_pipeline = [{"$match": match_conditions} if match_conditions else {"$match": {}}, {"$count": "total"}]
        count_result = await db.procedures.aggregate(count_pipeline).to_list(1)
        total = count_result[0]["total"] if count_result else 0
        
        return {
            "procedures": procedures,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    @staticmethod
    async def get_dashboard_stats_optimized(db, user_role: str, user_id: str) -> Dict[str, Any]:
        """Super optimized dashboard stats using parallel aggregations"""
        
        if user_role in ["ADMIN", "REGISTRAR"]:
            # Admin stats with parallel aggregations
            pipelines = {
                "students": [
                    {"$match": {"status": "ENROLLED"}},
                    {"$count": "total"}
                ],
                "courses": [
                    {"$match": {"is_active": True}},
                    {"$count": "total"}
                ],
                "enrollments": [
                    {"$match": {"status": "ACTIVE"}},
                    {"$count": "total"}
                ],
                "procedures": [
                    {"$match": {}},
                    {"$count": "total"}
                ],
                "pending_procedures": [
                    {"$match": {"status": {"$in": ["RECEIVED", "IN_PROCESS"]}}},
                    {"$count": "total"}
                ],
                "applicants": [
                    {"$match": {}},
                    {"$count": "total"}
                ]
            }
            
            # Execute all aggregations in parallel
            tasks = []
            for stat_name, pipeline in pipelines.items():
                if stat_name in ["students"]:
                    collection = db.students
                elif stat_name in ["courses"]:
                    collection = db.courses
                elif stat_name in ["enrollments"]:
                    collection = db.enrollments
                elif stat_name in ["procedures", "pending_procedures"]:
                    collection = db.procedures
                elif stat_name in ["applicants"]:
                    collection = db.applicants
                
                task = collection.aggregate(pipeline).to_list(1)
                tasks.append((stat_name, task))
            
            results = await asyncio.gather(*[task for _, task in tasks])
            
            stats = {}
            for i, (stat_name, _) in enumerate(tasks):
                count_result = results[i]
                stats[stat_name.replace("_", "")] = count_result[0]["total"] if count_result else 0
            
            return stats
            
        elif user_role == "TEACHER":
            # Teacher stats
            pipelines = {
                "my_courses": [
                    {"$match": {"teacher_id": user_id}},
                    {"$count": "total"}
                ],
                "pending_grades": [
                    {"$match": {"teacher_id": user_id, "grade_status": "INCOMPLETE"}},
                    {"$count": "total"}
                ]
            }
            
            tasks = []
            for stat_name, pipeline in pipelines.items():
                task = db.enrollments.aggregate(pipeline).to_list(1)
                tasks.append((stat_name, task))
            
            results = await asyncio.gather(*[task for _, task in tasks])
            
            stats = {}
            for i, (stat_name, _) in enumerate(tasks):
                count_result = results[i]
                stats[stat_name] = count_result[0]["total"] if count_result else 0
            
            return stats
            
        elif user_role == "STUDENT":
            # Student stats
            pipelines = {
                "my_enrollments": [
                    {"$match": {"student_id": user_id}},
                    {"$count": "total"}
                ],
                "approved_courses": [
                    {"$match": {"student_id": user_id, "grade_status": "APPROVED"}},
                    {"$count": "total"}
                ]
            }
            
            tasks = []
            for stat_name, pipeline in pipelines.items():
                task = db.enrollments.aggregate(pipeline).to_list(1)
                tasks.append((stat_name, task))
            
            results = await asyncio.gather(*[task for _, task in tasks])
            
            stats = {}
            for i, (stat_name, _) in enumerate(tasks):
                count_result = results[i]
                stats[stat_name] = count_result[0]["total"] if count_result else 0
            
            return stats
        
        return {}

    @staticmethod
    async def batch_fetch_related_data(
        db,
        main_collection: str,
        main_ids: List[str],
        related_collections: Dict[str, Dict[str, str]]
    ) -> Dict[str, Dict[str, Any]]:
        """Batch fetch related data to avoid N+1 queries"""
        
        results = {}
        
        for collection_name, config in related_collections.items():
            local_field = config["local_field"]  # Field in main collection
            foreign_field = config["foreign_field"]  # Field in related collection
            
            # Get unique IDs from main collection
            unique_ids = list(set([id for id in main_ids if id]))
            
            if unique_ids:
                # Fetch related documents
                related_docs = await getattr(db, collection_name).find(
                    {foreign_field: {"$in": unique_ids}}
                ).to_list(length=None)
                
                # Index by foreign field for quick lookup
                indexed_docs = {doc[foreign_field]: doc for doc in related_docs}
                results[collection_name] = indexed_docs
        
        return results