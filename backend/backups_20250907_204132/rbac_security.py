"""
Role-Based Access Control (RBAC) Security Module
Implements comprehensive authorization matrix for Sistema Académico
"""
from fastapi import HTTPException, Depends, Request
from typing import List, Dict, Any, Optional, Callable
from enum import Enum
import logging
from functools import wraps

from shared_deps import get_current_user
from logging_middleware import get_correlation_id, log_with_correlation

logger = logging.getLogger("api.security")

class UserRole(str, Enum):
    # Administrative Roles
    ADMIN = "ADMIN"
    REGISTRAR = "REGISTRAR" 
    ADMIN_WORKER = "ADMIN_WORKER"
    
    # Academic Roles
    TEACHER = "TEACHER"
    ACADEMIC_STAFF = "ACADEMIC_STAFF"
    
    # Student and External Roles
    STUDENT = "STUDENT"
    APPLICANT = "APPLICANT"
    EXTERNAL_USER = "EXTERNAL_USER"
    
    # Financial and Operational Roles
    FINANCE_ADMIN = "FINANCE_ADMIN"
    CASHIER = "CASHIER"
    WAREHOUSE = "WAREHOUSE" 
    HR_ADMIN = "HR_ADMIN"
    LOGISTICS = "LOGISTICS"

class ResourceType(str, Enum):
    STUDENT = "STUDENT"
    COURSE = "COURSE"
    ENROLLMENT = "ENROLLMENT"
    GRADE = "GRADE"
    PROCEDURE = "PROCEDURE"
    RECEIPT = "RECEIPT"
    APPLICATION = "APPLICATION"
    INVENTORY = "INVENTORY"
    REPORT = "REPORT"

class Permission(str, Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    EXECUTE = "EXECUTE"

class RBACSecurityManager:
    """Manages role-based access control"""
    
    def __init__(self):
        self.permission_matrix = self._build_permission_matrix()
        self.context_validators = self._build_context_validators()
    
    def _build_permission_matrix(self) -> Dict[UserRole, Dict[ResourceType, List[Permission]]]:
        """Build the complete permission matrix"""
        return {
            # Administrative Roles
            UserRole.ADMIN: {
                ResourceType.STUDENT: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.COURSE: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE], 
                ResourceType.ENROLLMENT: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.GRADE: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.PROCEDURE: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.RECEIPT: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.APPLICATION: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.INVENTORY: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.REPORT: [Permission.CREATE, Permission.READ, Permission.EXECUTE]
            },
            
            UserRole.REGISTRAR: {
                ResourceType.STUDENT: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.COURSE: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.ENROLLMENT: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.GRADE: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.PROCEDURE: [Permission.READ, Permission.UPDATE],
                ResourceType.APPLICATION: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.REPORT: [Permission.CREATE, Permission.READ, Permission.EXECUTE]
            },
            
            UserRole.ADMIN_WORKER: {
                ResourceType.STUDENT: [Permission.READ],
                ResourceType.PROCEDURE: [Permission.CREATE, Permission.READ, Permission.UPDATE],
                ResourceType.RECEIPT: [Permission.READ],
                ResourceType.REPORT: [Permission.READ]
            },
            
            # Academic Roles
            UserRole.TEACHER: {
                ResourceType.STUDENT: [Permission.READ],  # Only enrolled in their courses
                ResourceType.COURSE: [Permission.READ],   # Only their assigned courses
                ResourceType.ENROLLMENT: [Permission.READ, Permission.UPDATE],  # Only their courses
                ResourceType.GRADE: [Permission.CREATE, Permission.READ, Permission.UPDATE],  # Only their courses
                ResourceType.PROCEDURE: [Permission.CREATE, Permission.READ],
                ResourceType.REPORT: [Permission.READ, Permission.EXECUTE]  # Only their courses
            },
            
            UserRole.ACADEMIC_STAFF: {
                ResourceType.STUDENT: [Permission.READ],
                ResourceType.COURSE: [Permission.READ],
                ResourceType.ENROLLMENT: [Permission.READ],
                ResourceType.APPLICATION: [Permission.CREATE, Permission.READ, Permission.UPDATE],
                ResourceType.REPORT: [Permission.READ, Permission.EXECUTE]
            },
            
            # Student and External Roles
            UserRole.STUDENT: {
                ResourceType.STUDENT: [Permission.READ, Permission.UPDATE],  # Only own data
                ResourceType.COURSE: [Permission.READ], 
                ResourceType.ENROLLMENT: [Permission.CREATE, Permission.READ],  # Only own enrollments
                ResourceType.GRADE: [Permission.READ],  # Only own grades
                ResourceType.PROCEDURE: [Permission.CREATE, Permission.READ],  # Only own procedures
                ResourceType.RECEIPT: [Permission.READ],  # Only own receipts
                ResourceType.REPORT: [Permission.READ]  # Only own reports
            },
            
            UserRole.APPLICANT: {
                ResourceType.APPLICATION: [Permission.CREATE, Permission.READ, Permission.UPDATE],  # Only own
                ResourceType.PROCEDURE: [Permission.CREATE, Permission.READ],  # Only own
                ResourceType.RECEIPT: [Permission.READ]  # Only own
            },
            
            UserRole.EXTERNAL_USER: {
                ResourceType.PROCEDURE: [Permission.CREATE, Permission.READ],  # Only own
                ResourceType.RECEIPT: [Permission.READ]  # Only own
            },
            
            # Financial and Operational Roles
            UserRole.FINANCE_ADMIN: {
                ResourceType.RECEIPT: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.INVENTORY: [Permission.CREATE, Permission.READ, Permission.UPDATE, Permission.DELETE],
                ResourceType.REPORT: [Permission.CREATE, Permission.READ, Permission.EXECUTE]
            },
            
            UserRole.CASHIER: {
                ResourceType.RECEIPT: [Permission.CREATE, Permission.READ, Permission.UPDATE],
                ResourceType.REPORT: [Permission.READ]
            },
            
            UserRole.WAREHOUSE: {
                ResourceType.INVENTORY: [Permission.CREATE, Permission.READ, Permission.UPDATE],
                ResourceType.REPORT: [Permission.READ, Permission.EXECUTE]
            },
            
            UserRole.HR_ADMIN: {
                ResourceType.STUDENT: [Permission.READ],  # For HR purposes
                ResourceType.REPORT: [Permission.CREATE, Permission.READ, Permission.EXECUTE]
            },
            
            UserRole.LOGISTICS: {
                ResourceType.INVENTORY: [Permission.READ],
                ResourceType.REPORT: [Permission.READ]
            }
        }
    
    def _build_context_validators(self) -> Dict[str, Callable]:
        """Build context validation functions"""
        return {
            "student_data_access": self._validate_student_data_access,
            "course_assignment": self._validate_course_assignment,
            "enrollment_ownership": self._validate_enrollment_ownership,
            "procedure_ownership": self._validate_procedure_ownership,
            "receipt_ownership": self._validate_receipt_ownership,
            "grade_editing": self._validate_grade_editing,
            "report_scope": self._validate_report_scope
        }
    
    def has_permission(self, user_role: UserRole, resource_type: ResourceType, permission: Permission) -> bool:
        """Check if user role has specific permission for resource type"""
        if user_role == UserRole.ADMIN:
            return True  # Admin has all permissions
        
        role_permissions = self.permission_matrix.get(user_role, {})
        resource_permissions = role_permissions.get(resource_type, [])
        
        return permission in resource_permissions
    
    async def _validate_student_data_access(self, current_user, student_id: str, db) -> bool:
        """Validate student data access based on role and context"""
        if current_user.role == UserRole.STUDENT:
            # Students can only access their own data
            return current_user.id == student_id
        
        if current_user.role == UserRole.TEACHER:
            # Teachers can access students enrolled in their courses
            enrollment_exists = await db.enrollments.find_one({
                "student_id": student_id,
                "teacher_id": current_user.id,
                "status": "ACTIVE"
            })
            return enrollment_exists is not None
        
        # Admin, Registrar, Academic Staff have full access
        return current_user.role in [UserRole.ADMIN, UserRole.REGISTRAR, UserRole.ACADEMIC_STAFF]
    
    async def _validate_course_assignment(self, current_user, course_id: str, db) -> bool:
        """Validate course assignment access for teachers"""
        if current_user.role == UserRole.TEACHER:
            # Teachers can only access courses they are assigned to
            enrollment_exists = await db.enrollments.find_one({
                "course_id": course_id,
                "teacher_id": current_user.id
            })
            return enrollment_exists is not None
        
        # Admin and Registrar have full access
        return current_user.role in [UserRole.ADMIN, UserRole.REGISTRAR]
    
    async def _validate_enrollment_ownership(self, current_user, enrollment_id: str, db) -> bool:
        """Validate enrollment access based on ownership"""
        enrollment = await db.enrollments.find_one({"id": enrollment_id})
        if not enrollment:
            return False
        
        if current_user.role == UserRole.STUDENT:
            return enrollment["student_id"] == current_user.id
        
        if current_user.role == UserRole.TEACHER:
            return enrollment["teacher_id"] == current_user.id
        
        return current_user.role in [UserRole.ADMIN, UserRole.REGISTRAR]
    
    async def _validate_procedure_ownership(self, current_user, procedure_id: str, db) -> bool:
        """Validate procedure access based on ownership or assignment"""
        procedure = await db.procedures.find_one({"id": procedure_id})
        if not procedure:
            return False
        
        # Owner or assignee can access
        if (procedure.get("created_by") == current_user.id or 
            procedure.get("assigned_to") == current_user.id):
            return True
        
        # Admin and Admin Workers have full access
        return current_user.role in [UserRole.ADMIN, UserRole.ADMIN_WORKER]
    
    async def _validate_receipt_ownership(self, current_user, receipt_id: str, db) -> bool:
        """Validate receipt access based on ownership"""
        receipt = await db.receipts.find_one({"id": receipt_id})
        if not receipt:
            return False
        
        if current_user.role in [UserRole.STUDENT, UserRole.APPLICANT, UserRole.EXTERNAL_USER]:
            return receipt.get("payer_id") == current_user.id
        
        # Financial roles and admin have full access
        return current_user.role in [UserRole.ADMIN, UserRole.FINANCE_ADMIN, UserRole.CASHIER]
    
    async def _validate_grade_editing(self, current_user, enrollment_id: str, db) -> bool:
        """Validate grade editing permissions"""
        enrollment = await db.enrollments.find_one({"id": enrollment_id})
        if not enrollment:
            return False
        
        if current_user.role == UserRole.TEACHER:
            return enrollment["teacher_id"] == current_user.id
        
        return current_user.role in [UserRole.ADMIN, UserRole.REGISTRAR]
    
    async def _validate_report_scope(self, current_user, report_params: Dict[str, Any], db) -> bool:
        """Validate report generation scope based on role"""
        if current_user.role in [UserRole.ADMIN, UserRole.REGISTRAR]:
            return True  # Full access to all reports
        
        if current_user.role == UserRole.TEACHER:
            # Teachers can only generate reports for their courses
            course_id = report_params.get("course_id")
            if course_id:
                return await self._validate_course_assignment(current_user, course_id, db)
        
        if current_user.role == UserRole.STUDENT:
            # Students can only access their own reports
            student_id = report_params.get("student_id")
            return student_id == current_user.id
        
        return False

# Global RBAC manager instance
rbac_manager = RBACSecurityManager()

def require_permission(
    resource_type: ResourceType, 
    permission: Permission,
    context_validator: Optional[str] = None,
    context_params: Optional[Dict[str, Any]] = None
):
    """Decorator for endpoint permission checking"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract dependencies
            request = None
            current_user = None
            db = None
            
            # Find dependencies in kwargs
            for key, value in kwargs.items():
                if hasattr(value, 'method'):  # Request object
                    request = value
                elif hasattr(value, 'role'):  # User object
                    current_user = value
                elif hasattr(value, 'students'):  # Database object
                    db = value
            
            if not current_user:
                raise HTTPException(status_code=401, detail="Autenticación requerida")
            
            # Check basic permission
            if not rbac_manager.has_permission(current_user.role, resource_type, permission):
                correlation_id = get_correlation_id(request) if request else "unknown"
                
                log_with_correlation(
                    logger, "warning",
                    f"Permission denied: {current_user.role} attempted {permission} on {resource_type}",
                    request,
                    user_data={"id": current_user.id, "username": current_user.username, "role": current_user.role},
                    extra_data={"correlation_id": correlation_id}
                )
                
                raise HTTPException(
                    status_code=403, 
                    detail=f"No autorizado para {permission.lower()} {resource_type.lower()}"
                )
            
            # Check context validation if specified
            if context_validator and db:
                validator_func = rbac_manager.context_validators.get(context_validator)
                if validator_func:
                    # Extract context parameters from function arguments
                    if context_params:
                        validation_params = {}
                        for param_name, kwarg_name in context_params.items():
                            validation_params[param_name] = kwargs.get(kwarg_name)
                        
                        is_valid = await validator_func(current_user, db=db, **validation_params)
                        if not is_valid:
                            correlation_id = get_correlation_id(request) if request else "unknown"
                            
                            log_with_correlation(
                                logger, "warning",
                                f"Context validation failed: {current_user.role} on {resource_type}",
                                request,
                                user_data={"id": current_user.id, "username": current_user.username, "role": current_user.role},
                                extra_data={"correlation_id": correlation_id, "context": context_params}
                            )
                            
                            raise HTTPException(
                                status_code=403,
                                detail="Acceso denegado al recurso específico"
                            )
            
            # Log successful authorization
            if request:
                log_with_correlation(
                    logger, "debug",
                    f"Authorization granted: {current_user.role} {permission} on {resource_type}",
                    request,
                    user_data={"id": current_user.id, "username": current_user.username, "role": current_user.role}
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def require_role(allowed_roles: List[UserRole]):
    """Simple role-based access decorator"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = None
            request = None
            
            # Find current_user in kwargs
            for key, value in kwargs.items():
                if hasattr(value, 'role'):
                    current_user = value
                elif hasattr(value, 'method'):
                    request = value
            
            if not current_user:
                raise HTTPException(status_code=401, detail="Autenticación requerida")
            
            # Admin role has access to everything
            if current_user.role == UserRole.ADMIN or current_user.role in allowed_roles:
                return await func(*args, **kwargs)
            
            correlation_id = get_correlation_id(request) if request else "unknown"
            
            log_with_correlation(
                logger, "warning",
                f"Role access denied: {current_user.role} not in {[r.value for r in allowed_roles]}",
                request,
                user_data={"id": current_user.id, "username": current_user.username, "role": current_user.role},
                extra_data={"correlation_id": correlation_id, "allowed_roles": [r.value for r in allowed_roles]}
            )
            
            raise HTTPException(
                status_code=403,
                detail=f"Acceso denegado. Roles requeridos: {[role.value for role in allowed_roles]}"
            )
        
        return wrapper
    return decorator

# Specific authorization functions for common use cases
async def authorize_student_data_access(current_user, student_id: str, db):
    """Authorize access to student data"""
    return await rbac_manager._validate_student_data_access(current_user, student_id, db)

async def authorize_course_management(current_user, course_id: str, db):
    """Authorize course management access"""
    return await rbac_manager._validate_course_assignment(current_user, course_id, db)

async def authorize_grade_editing(current_user, enrollment_id: str, db):
    """Authorize grade editing access"""
    return await rbac_manager._validate_grade_editing(current_user, enrollment_id, db)

async def authorize_procedure_access(current_user, procedure_id: str, db):
    """Authorize procedure access"""
    return await rbac_manager._validate_procedure_ownership(current_user, procedure_id, db)

class SecurityAuditLogger:
    """Audit logger for security events"""
    
    @staticmethod
    async def log_access_granted(user, resource_type: str, action: str, request: Request = None):
        """Log successful access"""
        log_with_correlation(
            logger, "info",
            f"Access granted: {user.role} {action} on {resource_type}",
            request,
            user_data={"id": user.id, "username": user.username, "role": user.role},
            extra_data={"resource_type": resource_type, "action": action}
        )
    
    @staticmethod
    async def log_access_denied(user, resource_type: str, action: str, reason: str, request: Request = None):
        """Log access denial"""
        log_with_correlation(
            logger, "warning",
            f"Access denied: {user.role} {action} on {resource_type} - {reason}",
            request,
            user_data={"id": user.id, "username": user.username, "role": user.role},
            extra_data={"resource_type": resource_type, "action": action, "denial_reason": reason}
        )
    
    @staticmethod
    async def log_privilege_escalation_attempt(user, attempted_action: str, request: Request = None):
        """Log potential privilege escalation attempts"""
        log_with_correlation(
            logger, "error",
            f"Privilege escalation attempt: {user.role} attempted {attempted_action}",
            request,
            user_data={"id": user.id, "username": user.username, "role": user.role},
            extra_data={"attempted_action": attempted_action, "security_alert": True}
        )

# Global security audit logger
security_audit = SecurityAuditLogger()