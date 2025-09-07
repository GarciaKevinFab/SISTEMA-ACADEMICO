#!/usr/bin/env python3
"""
MongoDB Update Operations Validator
Prevents commits with problematic MongoDB update operations
"""
import ast
import sys
import glob
import os
from typing import List, Dict

class MongoUpdateValidator(ast.NodeVisitor):
    """AST visitor to validate MongoDB update operations"""
    
    def __init__(self, filename: str):
        self.filename = filename
        self.errors = []
        self.warnings = []
        self.has_safe_imports = False
        self.safe_import_names = set()
        
    def visit_ImportFrom(self, node):
        """Check for safe_mongo_operations imports"""
        if node.module == 'safe_mongo_operations':
            self.has_safe_imports = True
            if node.names:
                for alias in node.names:
                    self.safe_import_names.add(alias.name)
        self.generic_visit(node)
    
    def visit_Call(self, node):
        """Check function calls for MongoDB update operations"""
        if isinstance(node.func, ast.Attribute):
            method_name = node.func.attr
            
            # Check for direct MongoDB update calls
            if method_name in ['update_one', 'update_many', 'find_one_and_update']:
                # Allow if it's already wrapped by safe_ functions
                if not self._is_safe_call(node):
                    self.errors.append({
                        'line': node.lineno,
                        'column': node.col_offset,
                        'method': method_name,
                        'severity': 'ERROR',
                        'message': f'Direct .{method_name}() call detected. Use safe_{method_name}() wrapper instead.',
                        'suggestion': f'Replace with: await safe_{method_name}(collection, filter, update)'
                    })
            
            # Check for safe update calls
            elif method_name in ['safe_update_one', 'safe_update_many', 'safe_find_one_and_update']:
                if not self.has_safe_imports:
                    self.errors.append({
                        'line': node.lineno,
                        'column': node.col_offset,
                        'method': method_name,
                        'severity': 'ERROR',
                        'message': f'Using {method_name} without importing from safe_mongo_operations',
                        'suggestion': 'Add: from safe_mongo_operations import safe_update_one, safe_update_many, safe_find_one_and_update'
                    })
                elif method_name not in self.safe_import_names:
                    self.warnings.append({
                        'line': node.lineno,
                        'column': node.col_offset,
                        'method': method_name,
                        'severity': 'WARNING',
                        'message': f'{method_name} used but not explicitly imported',
                        'suggestion': f'Add {method_name} to your import statement'
                    })
        
        self.generic_visit(node)
    
    def _is_safe_call(self, node):
        """Check if the call is already within a safe wrapper context"""
        # This is a simplified check - in practice, you might want more sophisticated analysis
        return False

def validate_file(filepath: str) -> Dict:
    """Validate a single Python file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        tree = ast.parse(content, filename=filepath)
        validator = MongoUpdateValidator(filepath)
        validator.visit(tree)
        
        return {
            'filepath': filepath,
            'errors': validator.errors,
            'warnings': validator.warnings,
            'has_safe_imports': validator.has_safe_imports
        }
        
    except SyntaxError as e:
        return {
            'filepath': filepath,
            'errors': [{
                'line': e.lineno or 0,
                'column': e.offset or 0,
                'method': 'syntax',
                'severity': 'ERROR',
                'message': f'Syntax error: {e.msg}',
                'suggestion': 'Fix syntax errors before committing'
            }],
            'warnings': [],
            'has_safe_imports': False
        }
    except Exception as e:
        return {
            'filepath': filepath,
            'errors': [{
                'line': 0,
                'column': 0,
                'method': 'validation',
                'severity': 'ERROR',
                'message': f'Validation error: {str(e)}',
                'suggestion': 'Check file for issues'
            }],
            'warnings': [],
            'has_safe_imports': False
        }

def format_results(results: List[Dict]) -> str:
    """Format validation results for display"""
    output = []
    total_errors = 0
    total_warnings = 0
    
    for result in results:
        filepath = result['filepath']
        errors = result['errors']
        warnings = result['warnings']
        
        if errors or warnings:
            output.append(f"\n📄 {os.path.basename(filepath)}:")
            
            for error in errors:
                output.append(f"   ❌ Line {error['line']}: {error['message']}")
                if error.get('suggestion'):
                    output.append(f"      💡 {error['suggestion']}")
                total_errors += 1
            
            for warning in warnings:
                output.append(f"   ⚠️  Line {warning['line']}: {warning['message']}")
                if warning.get('suggestion'):
                    output.append(f"      💡 {warning['suggestion']}")
                total_warnings += 1
    
    if total_errors > 0 or total_warnings > 0:
        output.insert(0, f"🔍 MongoDB Update Validation Results:")
        output.append(f"\n📊 Summary: {total_errors} errors, {total_warnings} warnings")
        
        if total_errors > 0:
            output.append("🚫 Commit blocked due to validation errors")
            output.append("📖 See /app/reports/precommit_rules.md for guidelines")
        else:
            output.append("✅ No blocking errors found")
    else:
        output.append("✅ All MongoDB update operations are valid")
    
    return '\n'.join(output)

def validate_git_staged_files() -> List[Dict]:
    """Validate only Git staged files"""
    try:
        import subprocess
        result = subprocess.run(
            ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
            capture_output=True, text=True, cwd='/app'
        )
        
        if result.returncode != 0:
            return []
        
        staged_files = [f'/app/{f}' for f in result.stdout.strip().split('\n') 
                       if f.endswith('.py') and f]
        
        return [validate_file(filepath) for filepath in staged_files if os.path.exists(filepath)]
        
    except Exception:
        # Fallback to all backend files if git not available
        return validate_all_backend_files()

def validate_all_backend_files() -> List[Dict]:
    """Validate all backend Python files"""
    backend_files = glob.glob('/app/backend/*.py')
    # Exclude certain files
    excluded = ['mongo_update_replacer.py', 'safe_mongo_operations.py', '__pycache__']
    
    files_to_check = [f for f in backend_files 
                     if not any(exclude in f for exclude in excluded)]
    
    return [validate_file(filepath) for filepath in files_to_check]

def main():
    """Main validation function"""
    print("🔍 Validating MongoDB update operations...")
    
    # Check command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == '--staged':
            results = validate_git_staged_files()
        elif sys.argv[1] == '--all':
            results = validate_all_backend_files()
        else:
            # Validate specific files
            files = sys.argv[1:]
            results = [validate_file(f) for f in files if os.path.exists(f)]
    else:
        # Default: validate staged files if in git repo, otherwise all files
        if os.path.exists('/app/.git'):
            results = validate_git_staged_files()
        else:
            results = validate_all_backend_files()
    
    if not results:
        print("✅ No Python files to validate")
        sys.exit(0)
    
    # Format and display results
    output = format_results(results)
    print(output)
    
    # Determine exit code
    total_errors = sum(len(r['errors']) for r in results)
    
    if total_errors > 0:
        sys.exit(1)  # Block commit/CI
    else:
        sys.exit(0)  # Allow commit/CI

if __name__ == "__main__":
    main()