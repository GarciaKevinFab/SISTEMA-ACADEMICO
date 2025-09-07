"""
Tests for safe MongoDB operations wrapper
Validates that all update operations use proper $ operators
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from safe_mongo_operations import (
    validate_update_document, 
    safe_update_one, 
    safe_update_many, 
    safe_find_one_and_update,
    MongoUpdateError,
    build_set_update,
    build_inc_update, 
    build_push_update
)

class TestValidateUpdateDocument:
    """Test validation of update documents"""
    
    def test_valid_update_documents(self):
        """Test that valid update documents pass validation"""
        
        # Valid cases
        valid_updates = [
            {"$set": {"field": "value"}},
            {"$inc": {"count": 1}},
            {"$push": {"array": "item"}},
            {"$addToSet": {"set_field": "value"}},
            {"$pull": {"array": "item"}},
            {"$unset": {"field": ""}},
            {"$setOnInsert": {"field": "value"}},
            {"$set": {"field1": "value1"}, "$inc": {"field2": 1}},
            {"$set": {"complex": {"nested": "value"}}},
        ]
        
        for update in valid_updates:
            # Should not raise any exception
            validate_update_document(update)
    
    def test_invalid_update_documents(self):
        """Test that invalid update documents are rejected"""
        
        # Invalid cases
        invalid_updates = [
            {"field": "value"},  # No $ operator
            {"field1": "value1", "field2": "value2"},  # No $ operators
            {},  # Empty document
            {"": "value"},  # Empty key
            {"field": {"nested": "value"}},  # Nested without $set
        ]
        
        for update in invalid_updates:
            with pytest.raises(MongoUpdateError):
                validate_update_document(update)
    
    def test_invalid_input_types(self):
        """Test validation with invalid input types"""
        
        invalid_inputs = [None, "string", 123, []]
        
        for invalid_input in invalid_inputs:
            with pytest.raises(MongoUpdateError):
                validate_update_document(invalid_input)

class TestSafeUpdateOperations:
    """Test safe update operation wrappers"""
    
    @pytest.fixture
    def mock_collection(self):
        """Create a mock MongoDB collection"""
        collection = AsyncMock()
        collection.update_one = AsyncMock(return_value=MagicMock(matched_count=1, modified_count=1))
        collection.update_many = AsyncMock(return_value=MagicMock(matched_count=1, modified_count=1))
        collection.find_one_and_update = AsyncMock(return_value={"_id": "test", "field": "value"})
        return collection
    
    @pytest.mark.asyncio
    async def test_safe_update_one_valid(self, mock_collection):
        """Test safe_update_one with valid update document"""
        
        filter_doc = {"_id": "test"}
        update = {"$set": {"field": "value"}}
        
        result = await safe_update_one(mock_collection, filter_doc, update)
        
        mock_collection.update_one.assert_called_once_with(filter_doc, update, upsert=False)
        assert result.matched_count == 1
    
    @pytest.mark.asyncio
    async def test_safe_update_one_invalid(self, mock_collection):
        """Test safe_update_one with invalid update document"""
        
        filter_doc = {"_id": "test"}
        invalid_update = {"field": "value"}  # No $ operator
        
        with pytest.raises(MongoUpdateError):
            await safe_update_one(mock_collection, filter_doc, invalid_update)
        
        # Should not call actual update_one
        mock_collection.update_one.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_safe_update_one_with_upsert(self, mock_collection):
        """Test safe_update_one with upsert option"""
        
        filter_doc = {"_id": "test"}
        update = {"$setOnInsert": {"created_at": "now"}, "$set": {"updated_at": "now"}}
        
        await safe_update_one(mock_collection, filter_doc, update, upsert=True)
        
        mock_collection.update_one.assert_called_once_with(filter_doc, update, upsert=True)
    
    @pytest.mark.asyncio
    async def test_safe_update_many_valid(self, mock_collection):
        """Test safe_update_many with valid update document"""
        
        filter_doc = {"status": "pending"}
        update = {"$set": {"status": "processed"}}
        
        result = await safe_update_many(mock_collection, filter_doc, update)
        
        mock_collection.update_many.assert_called_once_with(filter_doc, update, upsert=False)
        assert result.matched_count == 1
    
    @pytest.mark.asyncio
    async def test_safe_find_one_and_update_valid(self, mock_collection):
        """Test safe_find_one_and_update with valid update document"""
        
        filter_doc = {"_id": "test"}
        update = {"$inc": {"attempts": 1}, "$set": {"status": "retry"}}
        
        result = await safe_find_one_and_update(mock_collection, filter_doc, update)
        
        mock_collection.find_one_and_update.assert_called_once_with(filter_doc, update, upsert=False)
        assert result["field"] == "value"

class TestHelperFunctions:
    """Test helper functions for building update documents"""
    
    def test_build_set_update(self):
        """Test build_set_update helper"""
        data = {"field1": "value1", "field2": "value2"}
        expected = {"$set": {"field1": "value1", "field2": "value2"}}
        
        result = build_set_update(data)
        assert result == expected
    
    def test_build_inc_update(self):
        """Test build_inc_update helper"""
        data = {"count": 1, "score": 10}
        expected = {"$inc": {"count": 1, "score": 10}}
        
        result = build_inc_update(data)
        assert result == expected
    
    def test_build_push_update(self):
        """Test build_push_update helper"""
        field = "tags"
        value = "new_tag"
        expected = {"$push": {"tags": "new_tag"}}
        
        result = build_push_update(field, value)
        assert result == expected

class TestMongoDBAuditScanner:
    """Test scanner to find problematic update operations in codebase"""
    
    def test_scan_for_problematic_updates(self):
        """Scan backend files for potentially problematic update operations"""
        import re
        import glob
        
        backend_files = glob.glob("../backend/*.py")
        problematic_patterns = []
        
        # Pattern to detect potential problematic updates
        # Looks for update_one/update_many calls that might not use $ operators
        pattern = r'(update_one|update_many|find_one_and_update)\s*\([^)]*\{[^$][^}]*\}[^)]*\)'
        
        for file_path in backend_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    # Find all matches
                    matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)
                    
                    for match in matches:
                        # Get line number
                        line_num = content[:match.start()].count('\n') + 1
                        
                        problematic_patterns.append({
                            'file': file_path,
                            'line': line_num,
                            'match': match.group().strip()[:100] + "..." if len(match.group()) > 100 else match.group().strip()
                        })
                        
            except Exception as e:
                print(f"Error scanning {file_path}: {e}")
        
        # Report findings
        if problematic_patterns:
            print(f"\n⚠️ Found {len(problematic_patterns)} potentially problematic update operations:")
            for pattern in problematic_patterns:
                print(f"  📄 {pattern['file']}:{pattern['line']} - {pattern['match']}")
        else:
            print("\n✅ No obviously problematic update patterns found")
        
        # Don't fail the test, just report
        return problematic_patterns

# Additional validation test cases for specific MINEDU patterns
class TestMINEDUUpdatePatterns:
    """Test specific patterns found in MINEDU integration"""
    
    def test_minedu_integration_patterns(self):
        """Test the update patterns used in MINEDU integration"""
        
        # Test patterns from minedu_integration.py
        minedu_patterns = [
            # Pattern from retry endpoint
            {
                "$set": {
                    "status": "RETRYING",
                    "updated_at": "2025-01-01T00:00:00"
                }
            },
            # Pattern from process_single_minedu_export
            {
                "$set": {
                    "status": "PROCESSING", 
                    "updated_at": "2025-01-01T00:00:00"
                },
                "$inc": {"attempts": 1}
            },
            # Pattern from success update
            {
                "$set": {
                    "status": "COMPLETED",
                    "updated_at": "2025-01-01T00:00:00",
                    "minedu_response": {"status": "success", "message": "Data exported successfully"}
                }
            },
            # Pattern from minedu_full_cycle.py
            {
                "$set": {
                    "minedu_sync_status": "SENT",
                    "minedu_id": "MINEDU_ID_123",
                    "minedu_sent_at": "2025-01-01T00:00:00",
                    "sync_attempts": 1
                }
            }
        ]
        
        # All these patterns should be valid
        for pattern in minedu_patterns:
            validate_update_document(pattern)  # Should not raise any exception
        
        print("✅ All MINEDU update patterns are valid")

if __name__ == "__main__":
    # Run basic validation tests
    print("🧪 Running safe MongoDB operations tests...")
    
    # Test validation
    test_validator = TestValidateUpdateDocument()
    test_validator.test_valid_update_documents()
    test_validator.test_invalid_update_documents()
    
    # Test helpers
    helper_test = TestHelperFunctions()
    helper_test.test_build_set_update()
    helper_test.test_build_inc_update()
    helper_test.test_build_push_update()
    
    # Test MINEDU patterns
    minedu_test = TestMINEDUUpdatePatterns()
    minedu_test.test_minedu_integration_patterns()
    
    # Scan for problematic patterns
    scanner = TestMongoDBAuditScanner()
    scanner.test_scan_for_problematic_updates()
    
    print("\n🎉 All tests completed!")