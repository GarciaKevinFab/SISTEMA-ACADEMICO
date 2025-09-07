"""
Test MINEDU Integration with Safe MongoDB Operations
Verifies that the fix for "ValueError: update only works with $ operators" is working
"""
import asyncio
import uuid
from datetime import datetime, timezone
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from shared_deps import db, logger
from safe_mongo_operations import safe_update_one, MongoUpdateError, test_safe_operations
from minedu_integration import MineduIntegrationStatus, MineduDataType, MineduExportRecord

class MINEDUIntegrationTest:
    """Test MINEDU integration with safe MongoDB operations"""
    
    def __init__(self):
        self.test_results = []
        self.test_export_id = None
    
    async def setup_test_data(self):
        """Setup test data for MINEDU integration"""
        logger.info("🔧 Setting up MINEDU test data...")
        
        # Create a test export record
        export_record = MineduExportRecord(
            record_id="test_student_001",
            data_type=MineduDataType.ENROLLMENT,
            record_data={
                "student_id": str(uuid.uuid4()),
                "course_id": str(uuid.uuid4()),
                "academic_year": 2025,
                "academic_period": "2025-I"
            }
        )
        
        # Convert to dict and prepare for MongoDB
        export_dict = export_record.__dict__
        if isinstance(export_dict.get('created_at'), datetime):
            export_dict['created_at'] = export_dict['created_at'].isoformat()
        if isinstance(export_dict.get('updated_at'), datetime):
            export_dict['updated_at'] = export_dict['updated_at'].isoformat()
        
        # Insert using safe operation
        await db.minedu_exports.insert_one(export_dict)
        self.test_export_id = export_record.id
        
        logger.info(f"✅ Test export record created: {self.test_export_id}")
    
    async def test_safe_update_with_valid_operators(self):
        """Test safe update operations with valid $ operators"""
        test_name = "Safe update with valid $ operators"
        logger.info(f"🧪 Testing: {test_name}")
        
        try:
            # Test valid update with $set and $inc
            result = await safe_update_one(
                db.minedu_exports,
                {"id": self.test_export_id},
                {
                    "$set": {
                        "status": MineduIntegrationStatus.PROCESSING,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$inc": {"attempts": 1}
                }
            )
            
            success = result.matched_count == 1 and result.modified_count == 1
            
            # Verify the update worked
            updated_record = await db.minedu_exports.find_one({"id": self.test_export_id})
            status_correct = updated_record["status"] == MineduIntegrationStatus.PROCESSING
            attempts_incremented = updated_record.get("attempts", 0) == 1
            
            test_result = {
                "test": test_name,
                "passed": success and status_correct and attempts_incremented,
                "expected": "Update successful with $set and $inc",
                "actual": f"Matched: {result.matched_count}, Modified: {result.modified_count}, Status: {updated_record.get('status')}, Attempts: {updated_record.get('attempts')}",
                "details": {
                    "matched_count": result.matched_count,
                    "modified_count": result.modified_count,
                    "final_status": updated_record.get("status"),
                    "final_attempts": updated_record.get("attempts")
                }
            }
            
            self.test_results.append(test_result)
            logger.info(f"{'✅' if test_result['passed'] else '❌'} {test_name}: {test_result['actual']}")
            
        except Exception as e:
            test_result = {
                "test": test_name,
                "passed": False,
                "expected": "Update successful",
                "actual": f"Exception: {str(e)}",
                "error": str(e)
            }
            self.test_results.append(test_result)
    
    async def test_safe_update_rejects_invalid_operators(self):
        """Test that safe update operations reject invalid documents"""
        test_name = "Safe update rejects invalid operators"
        logger.info(f"🧪 Testing: {test_name}")
        
        try:
            # This should raise MongoUpdateError
            await safe_update_one(
                db.minedu_exports,
                {"id": self.test_export_id},
                {
                    "status": "INVALID_UPDATE",  # No $ operator - should fail
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            )
            
            # If we get here, the test failed
            test_result = {
                "test": test_name,
                "passed": False,
                "expected": "MongoUpdateError raised",
                "actual": "Update succeeded when it should have failed",
                "error": "Invalid update was not rejected"
            }
            
        except MongoUpdateError as e:
            # This is expected
            test_result = {
                "test": test_name,
                "passed": True,
                "expected": "MongoUpdateError raised",
                "actual": f"MongoUpdateError: {str(e)}",
                "details": {"error_message": str(e)}
            }
            
        except Exception as e:
            # Unexpected error
            test_result = {
                "test": test_name,
                "passed": False,
                "expected": "MongoUpdateError raised",
                "actual": f"Unexpected exception: {str(e)}",
                "error": str(e)
            }
        
        self.test_results.append(test_result)
        logger.info(f"{'✅' if test_result['passed'] else '❌'} {test_name}: {test_result['actual']}")
    
    async def test_minedu_integration_workflow(self):
        """Test complete MINEDU integration workflow with safe operations"""
        test_name = "MINEDU integration workflow"
        logger.info(f"🧪 Testing: {test_name}")
        
        try:
            workflow_steps = []
            
            # Step 1: Set to processing
            result1 = await safe_update_one(
                db.minedu_exports,
                {"id": self.test_export_id},
                {
                    "$set": {
                        "status": MineduIntegrationStatus.PROCESSING,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$inc": {"attempts": 1}
                }
            )
            workflow_steps.append(f"Processing: {result1.modified_count == 1}")
            
            # Step 2: Set to completed  
            result2 = await safe_update_one(
                db.minedu_exports,
                {"id": self.test_export_id},
                {
                    "$set": {
                        "status": MineduIntegrationStatus.COMPLETED,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "minedu_response": {"status": "success", "message": "Test completed"}
                    }
                }
            )
            workflow_steps.append(f"Completed: {result2.modified_count == 1}")
            
            # Verify final state
            final_record = await db.minedu_exports.find_one({"id": self.test_export_id})
            final_status_correct = final_record["status"] == MineduIntegrationStatus.COMPLETED
            has_response = "minedu_response" in final_record
            
            workflow_steps.append(f"Final status: {final_status_correct}")
            workflow_steps.append(f"Has response: {has_response}")
            
            all_steps_passed = all(step.split(': ')[1] == 'True' for step in workflow_steps)
            
            test_result = {
                "test": test_name,
                "passed": all_steps_passed,
                "expected": "All workflow steps successful",
                "actual": f"Steps: {workflow_steps}",
                "details": {
                    "workflow_steps": workflow_steps,
                    "final_status": final_record.get("status"),
                    "final_attempts": final_record.get("attempts"),
                    "has_minedu_response": "minedu_response" in final_record
                }
            }
            
            self.test_results.append(test_result)
            logger.info(f"{'✅' if test_result['passed'] else '❌'} {test_name}: {test_result['actual']}")
            
        except Exception as e:
            test_result = {
                "test": test_name,
                "passed": False,
                "expected": "Workflow completed successfully",
                "actual": f"Exception: {str(e)}",
                "error": str(e)
            }
            self.test_results.append(test_result)
    
    async def test_error_handling_workflow(self):
        """Test error handling in MINEDU integration"""
        test_name = "MINEDU error handling workflow"
        logger.info(f"🧪 Testing: {test_name}")
        
        try:
            # Simulate processing with error
            result1 = await safe_update_one(
                db.minedu_exports,
                {"id": self.test_export_id},
                {
                    "$set": {
                        "status": MineduIntegrationStatus.PROCESSING,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$inc": {"attempts": 1}
                }
            )
            
            # Simulate failure
            result2 = await safe_update_one(
                db.minedu_exports,
                {"id": self.test_export_id},
                {
                    "$set": {
                        "status": MineduIntegrationStatus.FAILED,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "last_error": "Simulated API error for testing"
                    }
                }
            )
            
            # Verify error state
            error_record = await db.minedu_exports.find_one({"id": self.test_export_id})
            error_status_correct = error_record["status"] == MineduIntegrationStatus.FAILED
            has_error_message = "last_error" in error_record and error_record["last_error"]
            
            test_result = {
                "test": test_name,
                "passed": error_status_correct and has_error_message,
                "expected": "Error handling workflow successful",
                "actual": f"Status: {error_record.get('status')}, Has error: {has_error_message}",
                "details": {
                    "final_status": error_record.get("status"),
                    "error_message": error_record.get("last_error"),
                    "processing_result": result1.modified_count == 1,
                    "error_result": result2.modified_count == 1
                }
            }
            
            self.test_results.append(test_result)
            logger.info(f"{'✅' if test_result['passed'] else '❌'} {test_name}: {test_result['actual']}")
            
        except Exception as e:
            test_result = {
                "test": test_name,
                "passed": False,
                "expected": "Error handling successful",
                "actual": f"Exception: {str(e)}",
                "error": str(e)
            }
            self.test_results.append(test_result)
    
    async def cleanup_test_data(self):
        """Clean up test data"""
        if self.test_export_id:
            await db.minedu_exports.delete_one({"id": self.test_export_id})
            logger.info(f"🧹 Cleaned up test export: {self.test_export_id}")
    
    async def run_all_tests(self):
        """Run all MINEDU integration tests"""
        logger.info("🚀 Running MINEDU Integration Safe Operations Tests...")
        
        try:
            # Setup
            await self.setup_test_data()
            
            # Run tests
            await self.test_safe_update_with_valid_operators()
            await self.test_safe_update_rejects_invalid_operators()
            await self.test_minedu_integration_workflow()
            await self.test_error_handling_workflow()
            
            # Results
            passed_tests = sum(1 for result in self.test_results if result["passed"])
            total_tests = len(self.test_results)
            
            logger.info(f"📊 Test Results: {passed_tests}/{total_tests} passed ({passed_tests/total_tests*100:.1f}%)")
            
            return {
                "summary": {
                    "total_tests": total_tests,
                    "passed_tests": passed_tests,
                    "failed_tests": total_tests - passed_tests,
                    "pass_rate": passed_tests / total_tests * 100,
                    "all_passed": passed_tests == total_tests
                },
                "results": self.test_results
            }
            
        finally:
            # Always cleanup
            await self.cleanup_test_data()

async def run_minedu_integration_tests():
    """Run MINEDU integration tests with safe operations"""
    logger.info("🎯 Testing MINEDU Integration MongoDB Fix...")
    
    # First test safe operations basic functionality
    await test_safe_operations()
    
    # Then test MINEDU integration specifically
    test_suite = MINEDUIntegrationTest()
    results = await test_suite.run_all_tests()
    
    if results["summary"]["all_passed"]:
        logger.info("🎉 ALL TESTS PASSED - MongoDB 'update only works with $ operators' issue RESOLVED!")
    else:
        logger.error(f"❌ {results['summary']['failed_tests']} tests failed - Further investigation needed")
    
    return results

if __name__ == "__main__":
    asyncio.run(run_minedu_integration_tests())