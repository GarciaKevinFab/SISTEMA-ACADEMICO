# Pre-Commit Rules for MongoDB Update Operations

## Overview
This document defines pre-commit rules to prevent the "ValueError: update only works with $ operators" error from recurring in the codebase.

## Rules Implemented

### 1. MongoDB Update Operation Validation

**Rule**: All MongoDB update operations must use proper $ operators

**Patterns to Block**:
```python
# ❌ Forbidden patterns
collection.update_one(filter, {"field": "value"})
collection.update_many(filter, {"field": "value"})  
collection.find_one_and_update(filter, {"field": "value"})

# ✅ Required patterns
collection.update_one(filter, {"$set": {"field": "value"}})
collection.update_many(filter, {"$set": {"field": "value"}})
collection.find_one_and_update(filter, {"$set": {"field": "value"}})
```

### 2. Enforcement Strategy

**A. Code Analysis Hook**
- Pre-commit hook scans all `.py` files for problematic patterns
- Uses AST (Abstract Syntax Tree) analysis for accuracy
- Blocks commits containing invalid update operations

**B. Mandatory Safe Wrapper Usage**
- All update operations must use safe wrappers:
  - `safe_update_one()`
  - `safe_update_many()`
  - `safe_find_one_and_update()`

**C. Import Validation**
- Files containing update operations must import safe wrappers
- Direct use of `collection.update_*` methods is forbidden

## Pre-Commit Hook Implementation

### Git Hook Script (`/app/.git/hooks/pre-commit`)

```bash
#!/bin/bash
# Pre-commit hook to validate MongoDB update operations

echo "🔍 Validating MongoDB update operations..."

# Find Python files in the commit
PYTHON_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.py$')

if [ -z "$PYTHON_FILES" ]; then
    echo "✅ No Python files to check"
    exit 0
fi

# Check for problematic patterns
ERRORS=0

for file in $PYTHON_FILES; do
    # Check for direct update_one/update_many usage without safe wrappers
    if grep -n "\.update_one\|\.update_many\|\.find_one_and_update" "$file" | grep -v "safe_update" > /dev/null; then
        echo "❌ $file: Direct MongoDB update operations found"
        echo "   Use safe_update_one(), safe_update_many(), or safe_find_one_and_update() instead"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Check for import of safe operations if update operations are used
    if grep -n "safe_update_one\|safe_update_many\|safe_find_one_and_update" "$file" > /dev/null; then
        if ! grep -n "from safe_mongo_operations import" "$file" > /dev/null; then
            echo "❌ $file: Uses safe update operations but missing import"
            echo "   Add: from safe_mongo_operations import safe_update_one, safe_update_many, safe_find_one_and_update"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "🚫 Commit blocked due to MongoDB update operation violations"
    echo "📖 See /app/reports/precommit_rules.md for details"
    exit 1
else
    echo "✅ All MongoDB update operations are valid"
    exit 0
fi
```

### Python AST Validator (`/app/scripts/validate_mongo_updates.py`)

```python
#!/usr/bin/env python3
"""
Advanced MongoDB update validation using AST analysis
"""
import ast
import sys
import glob
from typing import List, Tuple

class MongoUpdateValidator(ast.NodeVisitor):
    """AST visitor to validate MongoDB update operations"""
    
    def __init__(self, filename: str):
        self.filename = filename
        self.errors = []
        self.has_safe_imports = False
        
    def visit_ImportFrom(self, node):
        """Check for safe_mongo_operations imports"""
        if node.module == 'safe_mongo_operations':
            self.has_safe_imports = True
        self.generic_visit(node)
    
    def visit_Call(self, node):
        """Check function calls for MongoDB update operations"""
        if isinstance(node.func, ast.Attribute):
            method_name = node.func.attr
            
            # Check for direct MongoDB update calls
            if method_name in ['update_one', 'update_many', 'find_one_and_update']:
                # Check if it's a safe wrapper call
                if not (isinstance(node.func.value, ast.Name) and 
                        node.func.value.id.startswith('safe_')):
                    self.errors.append({
                        'line': node.lineno,
                        'method': method_name,
                        'message': f'Direct {method_name} call detected. Use safe_{method_name} instead.'
                    })
            
            # Check for safe update calls without proper imports
            elif method_name.startswith('safe_update') or method_name == 'safe_find_one_and_update':
                if not self.has_safe_imports:
                    self.errors.append({
                        'line': node.lineno,
                        'method': method_name,
                        'message': f'Missing import for {method_name}. Add: from safe_mongo_operations import ...'
                    })
        
        self.generic_visit(node)

def validate_file(filepath: str) -> List[dict]:
    """Validate a single Python file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        tree = ast.parse(content, filename=filepath)
        validator = MongoUpdateValidator(filepath)
        validator.visit(tree)
        
        return validator.errors
        
    except SyntaxError as e:
        return [{'line': e.lineno, 'method': 'syntax', 'message': f'Syntax error: {e.msg}'}]
    except Exception as e:
        return [{'line': 0, 'method': 'unknown', 'message': f'Validation error: {str(e)}'}]

def main():
    """Main validation function"""
    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        files = glob.glob('/app/backend/*.py')
    
    total_errors = 0
    
    for filepath in files:
        errors = validate_file(filepath)
        
        if errors:
            print(f"❌ {filepath}:")
            for error in errors:
                print(f"   Line {error['line']}: {error['message']}")
            total_errors += len(errors)
    
    if total_errors > 0:
        print(f"\n🚫 Found {total_errors} MongoDB update validation errors")
        sys.exit(1)
    else:
        print("✅ All MongoDB update operations are valid")
        sys.exit(0)

if __name__ == "__main__":
    main()
```

## Continuous Integration Rules

### GitHub Actions Workflow

```yaml
name: MongoDB Update Validation
on: [push, pull_request]

jobs:
  validate-mongo-updates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Validate MongoDB Updates
        run: |
          python scripts/validate_mongo_updates.py
```

### IDE Integration

**VS Code Settings (`.vscode/settings.json`)**:
```json
{
    "python.linting.enabled": true,
    "python.linting.flake8Enabled": true,
    "python.linting.flake8Args": [
        "--select=E,W,F,C,N",
        "--ignore=E501,W503",
        "--extend-ignore=E203"
    ],
    "files.associations": {
        "*.py": "python"
    },
    "python.defaultInterpreterPath": "/app/backend/venv/bin/python"
}
```

## Testing Requirements

### Mandatory Tests

1. **Unit Tests**: Each file with MongoDB operations must have tests
2. **Integration Tests**: Validate end-to-end workflows
3. **Regression Tests**: Prevent reintroduction of the issue

### Test Coverage Requirements

- **Minimum Coverage**: 80% for files with MongoDB operations
- **Critical Paths**: 100% coverage for update operations
- **Error Handling**: All MongoUpdateError scenarios tested

## Documentation Requirements

### Code Documentation

1. **Docstrings**: All functions using MongoDB operations must be documented
2. **Examples**: Include usage examples in docstrings
3. **Error Handling**: Document all possible MongoUpdateError scenarios

### Architecture Documentation

1. **Update Patterns**: Document approved update patterns
2. **Migration Guide**: How to convert existing code
3. **Troubleshooting**: Common issues and solutions

## Monitoring and Alerting

### Production Monitoring

1. **Error Tracking**: Monitor for MongoUpdateError exceptions
2. **Performance**: Track update operation performance
3. **Usage Patterns**: Monitor adoption of safe wrappers

### Alerting Rules

```python
# Example monitoring alert
if mongodb_update_error_count > 0:
    alert("MongoDB update operation error detected", 
          details=error_details,
          severity="HIGH")
```

## Training and Onboarding

### Developer Guidelines

1. **Always** use safe wrapper functions
2. **Never** use direct collection.update_* methods
3. **Validate** all update documents have $ operators
4. **Test** update operations thoroughly
5. **Document** complex update patterns

### Code Review Checklist

- [ ] Uses safe wrapper functions
- [ ] Proper $ operators in update documents
- [ ] Error handling for MongoUpdateError
- [ ] Tests cover update scenarios
- [ ] Documentation updated

## Emergency Procedures

### If MongoDB Error Occurs in Production

1. **Immediate**: Identify the problematic update operation
2. **Fix**: Apply $ operators to the update document
3. **Test**: Verify fix in staging environment
4. **Deploy**: Apply hotfix to production
5. **Monitor**: Confirm resolution
6. **Post-mortem**: Update prevention measures

### Rollback Procedures

1. **Backup**: All modified files are backed up automatically
2. **Location**: `/app/backend/backups_YYYYMMDD_HHMMSS/`
3. **Restore**: Copy from backup to restore original files
4. **Verify**: Run tests to confirm restoration

## Metrics and KPIs

### Success Metrics

- **Zero** MongoDB update operator errors in production
- **100%** adoption of safe wrapper functions
- **Reduced** debugging time for MongoDB issues
- **Improved** code review efficiency

### Tracking

- Monitor error logs for "update only works with $ operators"
- Track usage of safe wrapper functions
- Measure time to detect and fix MongoDB issues
- Code review feedback on MongoDB operations

## Conclusion

These pre-commit rules provide comprehensive protection against MongoDB update operator errors while maintaining code quality and developer productivity. Regular monitoring and continuous improvement ensure the rules remain effective as the codebase evolves.