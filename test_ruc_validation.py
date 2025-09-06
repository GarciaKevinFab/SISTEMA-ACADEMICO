#!/usr/bin/env python3
"""
Test RUC validation function directly
"""

def validate_ruc(ruc: str) -> bool:
    """Validate Peruvian RUC"""
    if not ruc or len(ruc) != 11 or not ruc.isdigit():
        return False
    
    # RUC validation algorithm
    factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    check_digit = int(ruc[10])
    
    total = sum(int(ruc[i]) * factors[i] for i in range(10))
    remainder = total % 11
    calculated_check_digit = 11 - remainder if remainder >= 2 else remainder
    
    return check_digit == calculated_check_digit

# Test cases
test_rucs = [
    "20100070970",  # Should be valid
    "2010007097",   # 10 digits - should be invalid
    "201000709701", # 12 digits - should be invalid
    "2010007097A",  # Contains letter - should be invalid
    "20100070971",  # Wrong check digit - should be invalid
]

print("🔍 Testing RUC Validation Function:")
print("=" * 50)

for ruc in test_rucs:
    result = validate_ruc(ruc)
    print(f"RUC: {ruc} -> {'✅ VALID' if result else '❌ INVALID'}")
    
    if len(ruc) == 11 and ruc.isdigit():
        # Show calculation details
        factors = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
        check_digit = int(ruc[10])
        total = sum(int(ruc[i]) * factors[i] for i in range(10))
        remainder = total % 11
        calculated_check_digit = 11 - remainder if remainder >= 2 else remainder
        print(f"  Details: Total={total}, Remainder={remainder}, Calculated={calculated_check_digit}, Actual={check_digit}")
    
    print()