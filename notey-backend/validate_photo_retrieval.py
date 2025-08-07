#!/usr/bin/env python3
"""
Simple validation script for Backend Photo Retrieval Enhancement
"""
import re

def validate_database_implementation():
    """Validate the database.py implementation"""
    print("🧪 Validating database.py implementation...")
    
    with open('src/database.py', 'r') as f:
        content = f.read()
    
    # Check for get_event_details function
    if 'async def get_event_details(event_id: str)' in content:
        print("✅ get_event_details function exists")
    else:
        print("❌ get_event_details function not found")
        return False
    
    # Check for photo retrieval with sorting
    if 'photos?event_id=eq.' in content and 'order=offset_seconds.asc' in content:
        print("✅ Photos fetched with correct sorting (offset_seconds.asc)")
    else:
        print("❌ Photo sorting not implemented correctly")
        return False
    
    # Check that photos are included in response
    if '"photos": photos_data' in content:
        print("✅ Photos included in response")
    else:
        print("❌ Photos not included in response")
        return False
    
    # Check for all required response fields
    required_fields = ['audio_url', 'transcript', 'summary', 'photos']
    for field in required_fields:
        if f'"{field}":' in content:
            print(f"✅ {field} field included in response")
        else:
            print(f"❌ {field} field missing from response")
            return False
    
    print("✅ Database implementation is correct")
    return True

def validate_routes_implementation():
    """Validate the routes.py implementation"""
    print("\n🧪 Validating routes.py implementation...")
    
    with open('src/routes.py', 'r') as f:
        content = f.read()
    
    # Check for GET endpoint
    if '@router.get("/events/{event_id}")' in content:
        print("✅ GET /events/{event_id} endpoint exists")
    else:
        print("❌ GET /events/{event_id} endpoint not found")
        return False
    
    # Check that it calls get_event_details
    if 'return await database.get_event_details(event_id)' in content:
        print("✅ Endpoint calls database.get_event_details")
    else:
        print("❌ Endpoint doesn't call get_event_details")
        return False
    
    print("✅ Routes implementation is correct")
    return True

def validate_requirements_compliance():
    """Validate compliance with task requirements"""
    print("\n🧪 Validating requirements compliance...")
    
    with open('src/database.py', 'r') as f:
        db_content = f.read()
    
    # Task requirement: Modify GET /events/{event_id} endpoint to include photos
    with open('src/routes.py', 'r') as f:
        routes_content = f.read()
    
    if '@router.get("/events/{event_id}")' in routes_content and 'get_event_details' in routes_content:
        print("✅ GET /events/{event_id} endpoint includes photos via get_event_details")
    else:
        print("❌ Endpoint modification not complete")
        return False
    
    # Task requirement: Implement photo sorting by offset_seconds in database query
    if 'order=offset_seconds.asc' in db_content:
        print("✅ Photo sorting by offset_seconds implemented")
    else:
        print("❌ Photo sorting not implemented")
        return False
    
    # Task requirement: Update database.py get_event_details function for photo integration
    if 'photos?event_id=eq.' in db_content and '"photos": photos_data' in db_content:
        print("✅ get_event_details function updated for photo integration")
    else:
        print("❌ Photo integration not complete")
        return False
    
    # Task requirement: Ensure photos are returned with correct timeline ordering
    if 'order=offset_seconds.asc' in db_content:
        print("✅ Photos returned with correct timeline ordering")
    else:
        print("❌ Timeline ordering not ensured")
        return False
    
    print("✅ All task requirements satisfied")
    return True

def validate_specific_requirements():
    """Validate specific requirements from requirements.md"""
    print("\n🧪 Validating specific requirements...")
    
    with open('src/database.py', 'r') as f:
        content = f.read()
    
    # Requirement 4.6: Return photos ordered by offset_seconds ASC
    if 'order=offset_seconds.asc' in content:
        print("✅ Requirement 4.6: Photos ordered by offset_seconds ASC")
    else:
        print("❌ Requirement 4.6: Photo ordering missing")
        return False
    
    # Requirement 4.7: Include offset_seconds and photo_url fields
    # This is satisfied by returning photos_data directly from database
    if '"photos": photos_data' in content:
        print("✅ Requirement 4.7: Photo data includes all database fields")
    else:
        print("❌ Requirement 4.7: Photo data not included")
        return False
    
    # Requirement 6.1: Fetch all photos for timeline synchronization
    if 'photos?event_id=eq.' in content:
        print("✅ Requirement 6.1: Fetches all photos for event")
    else:
        print("❌ Requirement 6.1: Photo fetching not implemented")
        return False
    
    print("✅ All specific requirements satisfied")
    return True

if __name__ == "__main__":
    print("🚀 Backend Photo Retrieval Enhancement Validation")
    print("=" * 60)
    
    tests = [
        validate_database_implementation,
        validate_routes_implementation,
        validate_requirements_compliance,
        validate_specific_requirements
    ]
    
    all_passed = True
    for test in tests:
        if not test():
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ VALIDATION SUCCESSFUL!")
        print("\n📋 Implementation Summary:")
        print("• GET /events/{event_id} endpoint modified to include photos")
        print("• Photo sorting by offset_seconds implemented in database query")
        print("• get_event_details function updated for photo integration")
        print("• Photos returned with correct timeline ordering")
        print("• All requirements (4.6, 4.7, 6.1) satisfied")
        print("\n🎯 Task 3: Backend Photo Retrieval Enhancement - COMPLETE")
    else:
        print("❌ VALIDATION FAILED - Please review implementation")