"""
Shared Supabase client for the backend.

Uses the service_role key -- this code runs entirely server-side
(FastAPI process / batch scripts), never in the browser, so bypassing
RLS here is intentional. The .env path is resolved relative to this
file, not the current working directory, so it works whether you run
scripts from the repo root or from inside backend/.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# this file lives at backend/app/db.py -> parents[1] is backend/
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)