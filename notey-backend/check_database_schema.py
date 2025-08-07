#!/usr/bin/env python3
"""
Check the current database schema and table structure
"""
import asyncio
import httpx
import os
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }

async def check_table_structure():
    """Check the structure of our tables"""
    print("🔍 Checking database schema...")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Missing environment variables")
        return
    
    async with httpx.AsyncClient() as client:
        # Check events table
        print("\n📋 Checking events table...")
        try:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/events?limit=1",
                headers=get_supabase_headers()
            )
            
            if response.status_code == 200:
                print("✅ Events table exists and is accessible")
                data = response.json()
                if data:
                    print(f"Sample event structure: {list(data[0].keys())}")
                else:
                    print("📝 Events table is empty")
            else:
                print(f"❌ Events table error: {response.status_code}")
                print(f"Response: {response.text}")
                
        except Exception as e:
            print(f"❌ Events table check failed: {e}")
        
        # Check photos table
        print("\n📸 Checking photos table...")
        try:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/photos?limit=1",
                headers=get_supabase_headers()
            )
            
            if response.status_code == 200:
                print("✅ Photos table exists and is accessible")
                data = response.json()
                if data:
                    print(f"Sample photo structure: {list(data[0].keys())}")
                else:
                    print("📝 Photos table is empty")
            else:
                print(f"❌ Photos table error: {response.status_code}")
                print(f"Response: {response.text}")
                
        except Exception as e:
            print(f"❌ Photos table check failed: {e}")
        
        # Check users table
        print("\n👥 Checking users table...")
        try:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/users?limit=1",
                headers=get_supabase_headers()
            )
            
            if response.status_code == 200:
                print("✅ Users table exists and is accessible")
                data = response.json()
                if data:
                    print(f"Sample user structure: {list(data[0].keys())}")
                    print(f"Found {len(data)} existing user(s)")
                    return data[0]['id']  # Return first user ID for testing
                else:
                    print("📝 Users table is empty")
                    return None
            else:
                print(f"❌ Users table error: {response.status_code}")
                print(f"Response: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Users table check failed: {e}")
            return None

async def create_test_user():
    """Create a test user for testing"""
    print("\n👤 Creating test user...")
    
    test_user_id = str(uuid.uuid4())
    
    # Try different user data structures
    user_data_options = [
        {
            "id": test_user_id,
            "email": f"test-{test_user_id[:8]}@example.com"
        },
        {
            "id": test_user_id,
            "email": f"test-{test_user_id[:8]}@example.com",
            "created_at": "now()"
        }
    ]
    
    async with httpx.AsyncClient() as client:
        for i, user_data in enumerate(user_data_options):
            try:
                print(f"Trying user data structure {i+1}...")
                response = await client.post(
                    f"{SUPABASE_URL}/rest/v1/users",
                    headers={**get_supabase_headers(), "Prefer": "return=representation"},
                    json=user_data
                )
                
                if response.status_code in [200, 201]:
                    print(f"✅ Test user created: {test_user_id}")
                    return test_user_id
                else:
                    print(f"❌ User creation attempt {i+1} failed: {response.status_code}")
                    print(f"Response: {response.text}")
                    
            except Exception as e:
                print(f"❌ User creation attempt {i+1} failed: {e}")
        
        return None

async def test_create_event():
    """Test creating a simple event"""
    print("\n🧪 Testing event creation...")
    
    # First check if there are existing users
    existing_user_id = await check_table_structure()
    
    test_user_id = existing_user_id
    if not test_user_id:
        # Try to create a test user
        test_user_id = await create_test_user()
        
    if not test_user_id:
        print("⚠️  Cannot test event creation without a valid user")
        return
    
    test_event_id = str(uuid.uuid4())
    
    event_data = {
        "id": test_event_id,
        "user_id": test_user_id,
        "title": "Schema Check Test Event"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/events",
                headers={**get_supabase_headers(), "Prefer": "return=representation"},
                json=event_data
            )
            
            if response.status_code in [200, 201]:
                print("✅ Event creation successful")
                print(f"Created event: {response.json()}")
                
                # Clean up event
                await client.delete(
                    f"{SUPABASE_URL}/rest/v1/events?id=eq.{test_event_id}",
                    headers=get_supabase_headers()
                )
                print("🧹 Test event cleaned up")
                
                # Only clean up user if we created it
                if not existing_user_id:
                    await client.delete(
                        f"{SUPABASE_URL}/rest/v1/users?id=eq.{test_user_id}",
                        headers=get_supabase_headers()
                    )
                    print("🧹 Test user cleaned up")
                
            else:
                print(f"❌ Event creation failed: {response.status_code}")
                print(f"Response: {response.text}")
                
        except Exception as e:
            print(f"❌ Event creation test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_create_event())