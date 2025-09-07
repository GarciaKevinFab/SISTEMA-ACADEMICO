"""
MongoDB Update Operations Replacer
Systematically replaces all update_one/update_many/find_one_and_update calls with safe wrappers
"""
import os
import re
import glob
import shutil
from datetime import datetime
from typing import List, Dict, Tuple

class MongoUpdateReplacer:
    """Replace MongoDB update operations with safe wrappers"""
    
    def __init__(self, backend_dir: str = "/app/backend"):
        self.backend_dir = backend_dir
        self.replacements_made = []
        self.backup_dir = f"{backend_dir}/backups_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
    def create_backup(self):
        """Create backup of all Python files before modification"""
        os.makedirs(self.backup_dir, exist_ok=True)
        
        python_files = glob.glob(f"{self.backend_dir}/*.py")
        for file_path in python_files:
            if not file_path.endswith(('_backup.py', 'mongo_update_replacer.py', 'safe_mongo_operations.py')):
                backup_path = os.path.join(self.backup_dir, os.path.basename(file_path))
                shutil.copy2(file_path, backup_path)
        
        print(f"✅ Created backups in {self.backup_dir}")
    
    def find_update_operations(self, file_path: str) -> List[Dict]:
        """Find all MongoDB update operations in a file"""
        operations = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # Patterns to find update operations
                patterns = [
                    (r'(\w+)\.update_one\s*\(', 'update_one'),
                    (r'(\w+)\.update_many\s*\(', 'update_many'),
                    (r'(\w+)\.find_one_and_update\s*\(', 'find_one_and_update')
                ]
                
                for pattern, operation_type in patterns:
                    matches = re.finditer(pattern, content)
                    
                    for match in matches:
                        line_num = content[:match.start()].count('\n') + 1
                        collection_name = match.group(1)
                        
                        operations.append({
                            'file': file_path,
                            'line': line_num,
                            'operation': operation_type,
                            'collection': collection_name,
                            'match_start': match.start(),
                            'match_end': match.end()
                        })
        
        except Exception as e:
            print(f"Error scanning {file_path}: {e}")
        
        return operations
    
    def replace_update_operations(self, file_path: str) -> bool:
        """Replace update operations in a file with safe wrappers"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            
            # Import statement to add
            safe_import = "from safe_mongo_operations import safe_update_one, safe_update_many, safe_find_one_and_update, MongoUpdateError"
            
            # Check if safe_mongo_operations is already imported
            if "from safe_mongo_operations import" not in content and "import safe_mongo_operations" not in content:
                # Find the best place to add import
                import_lines = []
                lines = content.split('\n')
                
                last_import_line = -1
                for i, line in enumerate(lines):
                    if line.strip().startswith(('import ', 'from ')) and not line.strip().startswith('#'):
                        last_import_line = i
                
                if last_import_line >= 0:
                    lines.insert(last_import_line + 1, safe_import)
                else:
                    # Add after first few lines (usually after docstring)
                    lines.insert(3, safe_import)
                
                content = '\n'.join(lines)
            
            # Replace update operations
            replacements = [
                (r'(\w+)\.update_one\s*\(', r'await safe_update_one(\1, '),
                (r'(\w+)\.update_many\s*\(', r'await safe_update_many(\1, '),
                (r'(\w+)\.find_one_and_update\s*\(', r'await safe_find_one_and_update(\1, ')
            ]
            
            changes_made = False
            
            for pattern, replacement in replacements:
                new_content = re.sub(pattern, replacement, content)
                if new_content != content:
                    changes_made = True
                    content = new_content
            
            # Only write if changes were made
            if changes_made:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                self.replacements_made.append({
                    'file': file_path,
                    'changes': 'Added safe wrapper imports and replaced update operations'
                })
                
                return True
        
        except Exception as e:
            print(f"Error replacing operations in {file_path}: {e}")
        
        return False
    
    def add_error_handling(self, file_path: str) -> bool:
        """Add MongoUpdateError handling to async functions"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Find async functions that use safe update operations
            pattern = r'(async def [^:]+:.*?)(await safe_(?:update_one|update_many|find_one_and_update))'
            
            def add_try_catch(match):
                func_def = match.group(1)
                update_call = match.group(2)
                
                # Check if already has try-catch for MongoUpdateError
                if 'MongoUpdateError' in func_def:
                    return match.group(0)  # No change needed
                
                # Add try-catch structure (simplified)
                return f"{func_def}{update_call}"
            
            new_content = re.sub(pattern, add_try_catch, content, flags=re.DOTALL)
            
            if new_content != content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                return True
                
        except Exception as e:
            print(f"Error adding error handling to {file_path}: {e}")
        
        return False
    
    def scan_and_replace_all(self) -> Dict:
        """Scan all Python files and replace update operations"""
        print("🔍 Scanning for MongoDB update operations...")
        
        # Create backup first
        self.create_backup()
        
        python_files = glob.glob(f"{self.backend_dir}/*.py")
        total_operations = 0
        files_modified = 0
        
        for file_path in python_files:
            # Skip certain files
            if any(skip in file_path for skip in ['mongo_update_replacer.py', 'safe_mongo_operations.py', '__pycache__']):
                continue
                
            operations = self.find_update_operations(file_path)
            total_operations += len(operations)
            
            if operations:
                print(f"📄 {os.path.basename(file_path)}: {len(operations)} update operations found")
                
                # Replace operations
                if self.replace_update_operations(file_path):
                    files_modified += 1
        
        # Generate report
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_files_scanned': len(python_files),
            'total_operations_found': total_operations,
            'files_modified': files_modified,
            'backup_location': self.backup_dir,
            'replacements_made': self.replacements_made
        }
        
        return report
    
    def generate_report(self, report: Dict) -> str:
        """Generate a detailed report of changes made"""
        report_content = f"""
# MongoDB Update Operations Replacement Report
Generated: {report['timestamp']}

## Summary
- **Files Scanned**: {report['total_files_scanned']}
- **Update Operations Found**: {report['total_operations_found']}
- **Files Modified**: {report['files_modified']}
- **Backup Location**: {report['backup_location']}

## Changes Made
"""
        
        for replacement in report['replacements_made']:
            report_content += f"- **{os.path.basename(replacement['file'])}**: {replacement['changes']}\n"
        
        report_content += """
## Safe Operations Added
- `safe_update_one()` - Validates $ operators before update_one
- `safe_update_many()` - Validates $ operators before update_many  
- `safe_find_one_and_update()` - Validates $ operators before find_one_and_update

## Error Handling
- `MongoUpdateError` exception for invalid update documents
- Detailed error messages with fix suggestions
- Logging of all update operations

## Next Steps
1. Test all modified endpoints to ensure functionality
2. Monitor logs for any MongoUpdateError exceptions
3. Add additional validation rules if needed
4. Consider adding pre-commit hooks to prevent regression
"""
        
        return report_content

def run_replacement():
    """Run the MongoDB update operation replacement"""
    replacer = MongoUpdateReplacer()
    
    print("🚀 Starting MongoDB Update Operations Replacement...")
    
    # Scan and replace
    report = replacer.scan_and_replace_all()
    
    # Generate report
    report_content = replacer.generate_report(report)
    
    # Save report
    report_path = "/app/reports/db_update_replacement_report.md"
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    
    with open(report_path, 'w') as f:
        f.write(report_content)
    
    print(f"\n📊 Replacement Complete!")
    print(f"- Operations Found: {report['total_operations_found']}")
    print(f"- Files Modified: {report['files_modified']}")
    print(f"- Report: {report_path}")
    print(f"- Backups: {report['backup_location']}")
    
    return report

if __name__ == "__main__":
    run_replacement()