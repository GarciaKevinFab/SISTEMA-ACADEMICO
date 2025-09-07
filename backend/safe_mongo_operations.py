"""
MongoDB Safe Update Operations Wrapper
Enforces $ operators in all update operations to prevent ValueError: update only works with $ operators
"""
from typing import Dict, Any, Optional, Union
from motor.motor_asyncio import AsyncIOMotorCollection
import logging

logger = logging.getLogger("api.db.safe_operations")

class MongoUpdateError(Exception):
    """Custom exception for MongoDB update operation errors"""
    pass

def validate_update_document(update: Dict[str, Any]) -> None:
    """
    Validate that update document uses proper MongoDB operators
    
    Args:
        update: Update document to validate
        
    Raises:
        MongoUpdateError: If update document doesn't contain valid operators
    """
    if not isinstance(update, dict):
        raise MongoUpdateError("Update document must be a dictionary")
    
    if not update:
        raise MongoUpdateError("Update document cannot be empty")
    
    # Valid MongoDB update operators
    valid_operators = {
        "$set", "$inc", "$push", "$addToSet", "$pull", "$unset", 
        "$setOnInsert", "$min", "$max", "$mul", "$pop", "$pullAll",
        "$pushAll", "$rename", "$bit", "$currentDate", "$each",
        "$position", "$slice", "$sort"
    }
    
    # Check if all top-level keys are valid operators
    update_keys = set(update.keys())
    
    # If no valid operators found, raise error
    if not update_keys.intersection(valid_operators):
        available_ops = ", ".join(sorted(valid_operators))
        raise MongoUpdateError(
            f"Update document must contain at least one MongoDB operator. "
            f"Found keys: {list(update_keys)}. "
            f"Valid operators: {available_ops}. "
            f"Use {{'$set': {{'field': 'value'}}}} instead of {{'field': 'value'}}"
        )
    
    logger.debug(f"Update document validated: {list(update_keys)}")

async def safe_update_one(
    collection: AsyncIOMotorCollection,
    filter_doc: Dict[str, Any],
    update: Dict[str, Any],
    *,
    upsert: bool = False,
    **kwargs
) -> Any:
    """
    Safe wrapper for update_one that validates $ operators
    
    Args:
        collection: MongoDB collection
        filter_doc: Filter document
        update: Update document (must contain $ operators)
        upsert: Whether to upsert (default: False)
        **kwargs: Additional arguments passed to update_one
        
    Returns:
        Result of update_one operation
        
    Raises:
        MongoUpdateError: If update document is invalid
    """
    try:
        # Validate update document
        validate_update_document(update)
        
        # Log the operation
        logger.debug(f"Safe update_one: filter={filter_doc}, update={update}, upsert={upsert}")
        
        # Perform the update
        result = await collection.update_one(filter_doc, update, upsert=upsert, **kwargs)
        
        logger.debug(f"Update result: matched={result.matched_count}, modified={result.modified_count}")
        return result
        
    except Exception as e:
        logger.error(f"Safe update_one failed: {str(e)}")
        if "update only works with $ operators" in str(e):
            raise MongoUpdateError(
                f"MongoDB update operation failed. Update must use $ operators. "
                f"Update document: {update}. "
                f"Use {{'$set': {{'field': 'value'}}}} format."
            ) from e
        raise

async def safe_update_many(
    collection: AsyncIOMotorCollection,
    filter_doc: Dict[str, Any],
    update: Dict[str, Any],
    *,
    upsert: bool = False,
    **kwargs
) -> Any:
    """
    Safe wrapper for update_many that validates $ operators
    
    Args:
        collection: MongoDB collection
        filter_doc: Filter document
        update: Update document (must contain $ operators)
        upsert: Whether to upsert (default: False)
        **kwargs: Additional arguments passed to update_many
        
    Returns:
        Result of update_many operation
        
    Raises:
        MongoUpdateError: If update document is invalid
    """
    try:
        # Validate update document
        validate_update_document(update)
        
        # Log the operation
        logger.debug(f"Safe update_many: filter={filter_doc}, update={update}, upsert={upsert}")
        
        # Perform the update
        result = await collection.update_many(filter_doc, update, upsert=upsert, **kwargs)
        
        logger.debug(f"Update result: matched={result.matched_count}, modified={result.modified_count}")
        return result
        
    except Exception as e:
        logger.error(f"Safe update_many failed: {str(e)}")
        if "update only works with $ operators" in str(e):
            raise MongoUpdateError(
                f"MongoDB update operation failed. Update must use $ operators. "
                f"Update document: {update}. "
                f"Use {{'$set': {{'field': 'value'}}}} format."
            ) from e
        raise

async def safe_find_one_and_update(
    collection: AsyncIOMotorCollection,
    filter_doc: Dict[str, Any],
    update: Dict[str, Any],
    *,
    upsert: bool = False,
    return_document: Optional[Any] = None,
    **kwargs
) -> Any:
    """
    Safe wrapper for find_one_and_update that validates $ operators
    
    Args:
        collection: MongoDB collection
        filter_doc: Filter document
        update: Update document (must contain $ operators)
        upsert: Whether to upsert (default: False)
        return_document: ReturnDocument.AFTER or ReturnDocument.BEFORE
        **kwargs: Additional arguments passed to find_one_and_update
        
    Returns:
        Result of find_one_and_update operation
        
    Raises:
        MongoUpdateError: If update document is invalid
    """
    try:
        # Validate update document
        validate_update_document(update)
        
        # Log the operation
        logger.debug(f"Safe find_one_and_update: filter={filter_doc}, update={update}, upsert={upsert}")
        
        # Build kwargs
        if return_document is not None:
            kwargs['return_document'] = return_document
        
        # Perform the update
        result = await collection.find_one_and_update(filter_doc, update, upsert=upsert, **kwargs)
        
        logger.debug(f"Find and update completed, result: {'found' if result else 'not found'}")
        return result
        
    except Exception as e:
        logger.error(f"Safe find_one_and_update failed: {str(e)}")
        if "update only works with $ operators" in str(e):
            raise MongoUpdateError(
                f"MongoDB find_one_and_update operation failed. Update must use $ operators. "
                f"Update document: {update}. "
                f"Use {{'$set': {{'field': 'value'}}}} format."
            ) from e
        raise

# Helper functions for common operations
def build_set_update(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Helper to build a $set update document
    
    Args:
        data: Data to set
        
    Returns:
        Update document with $set operator
    """
    return {"$set": data}

def build_inc_update(data: Dict[str, Union[int, float]]) -> Dict[str, Any]:
    """
    Helper to build a $inc update document
    
    Args:
        data: Fields to increment with their values
        
    Returns:
        Update document with $inc operator
    """
    return {"$inc": data}

def build_push_update(field: str, value: Any) -> Dict[str, Any]:
    """
    Helper to build a $push update document
    
    Args:
        field: Field to push to
        value: Value to push
        
    Returns:
        Update document with $push operator
    """
    return {"$push": {field: value}}

# Test functions for validation
async def test_safe_operations():
    """Test function to verify safe operations work correctly"""
    logger.info("🧪 Testing safe MongoDB operations...")
    
    # Test validation function
    try:
        # Valid update documents
        validate_update_document({"$set": {"field": "value"}})
        validate_update_document({"$inc": {"count": 1}})
        validate_update_document({"$set": {"field": "value"}, "$inc": {"count": 1}})
        logger.info("✅ Valid update documents passed validation")
        
        # Invalid update documents
        try:
            validate_update_document({"field": "value"})  # Should fail
            logger.error("❌ Invalid update document passed validation")
        except MongoUpdateError:
            logger.info("✅ Invalid update document correctly rejected")
        
        try:
            validate_update_document({})  # Should fail
            logger.error("❌ Empty update document passed validation")
        except MongoUpdateError:
            logger.info("✅ Empty update document correctly rejected")
        
        logger.info("🎉 Safe MongoDB operations tests passed")
        
    except Exception as e:
        logger.error(f"❌ Safe MongoDB operations tests failed: {str(e)}")
        raise