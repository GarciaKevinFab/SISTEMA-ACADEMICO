#!/usr/bin/env python3
"""
Generate valid RUC for testing
"""

def calculate_ruc_check_digit(ruc_base: str) -> str:
    """Calculate check digit for RUC base (first 10 digits)"""
    if len(ruc_base) != 10 or not ruc_base.isdigit():
        return None
    
    factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    total = sum(int(ruc_base[i]) * factors[i] for i in range(10))
    remainder = total % 11
    
    if remainder < 2:
        check_digit = remainder
    else:
        check_digit = 11 - remainder
    
    return str(check_digit)

def validate_ruc(ruc: str) -> bool:
    """Validate Peruvian RUC"""
    if not ruc or len(ruc) != 11 or not ruc.isdigit():
        return False
    
    factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    check_digit = int(ruc[10])
    
    total = sum(int(ruc[i]) * factors[i] for i in range(10))
    remainder = total % 11
    
    if remainder < 2:
        calculated_check_digit = remainder
    else:
        calculated_check_digit = 11 - remainder
    
    return check_digit == calculated_check_digit

# Generate some valid RUCs for testing
test_bases = [
    "2010007097",  # Company RUC base
    "2012345678",  # Another company RUC base
    "1012345678",  # Individual RUC base
]

print("🔧 Generating Valid RUCs for Testing:")
print("=" * 50)

valid_rucs = []
for base in test_bases:
    check_digit = calculate_ruc_check_digit(base)
    if check_digit is not None:
        full_ruc = base + check_digit
        is_valid = validate_ruc(full_ruc)
        print(f"Base: {base} -> RUC: {full_ruc} -> {'✅ VALID' if is_valid else '❌ INVALID'}")
        if is_valid:
            valid_rucs.append(full_ruc)

print(f"\n📋 Valid RUCs for testing: {valid_rucs}")