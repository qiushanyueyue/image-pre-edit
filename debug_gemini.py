import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("API Key not found")
    exit(1)

genai.configure(api_key=api_key)

print(f"Listing models for key: {api_key[:5]}...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print(f"Error: {e}")
