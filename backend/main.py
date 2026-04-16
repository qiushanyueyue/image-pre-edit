import os
import sys

import uvicorn

CURRENT_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(CURRENT_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from api.index import app


if __name__ == "__main__":
    sys.stdout.reconfigure(line_buffering=True)
    uvicorn.run("api.index:app", host="0.0.0.0", port=8011, reload=True)
