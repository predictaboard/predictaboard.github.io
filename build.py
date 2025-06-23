# build.py

import os
import csv
import pandas as pd
import json
import requests
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "static" / "data"
TEMPLATE_DIR = ROOT / "templates"
OUTPUT_HTML = ROOT / "index.html"

# URLs to fetch
FILES = {
    "bbh_assessor_results.csv": "https://github.com/Kinds-of-Intelligence-CFI/PredictaBoard/raw/refs/heads/main/paper/results/bbh_assessor_results.csv",
    "mmlu_pro_assessor_results.csv": "https://github.com/Kinds-of-Intelligence-CFI/PredictaBoard/raw/refs/heads/main/paper/results/mmlu_pro_assessor_results.csv",
}

def download_files():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for filename, url in FILES.items():
        dest = DATA_DIR / filename
        print(f"Downloading {url} -> {dest}")
        r = requests.get(url)
        r.raise_for_status()
        with open(dest, "wb") as f:
            f.write(r.content)

def process_csv_to_json():
    for csv_name in FILES:
        csv_path = DATA_DIR / csv_name
        json_path = DATA_DIR / csv_name.replace(".csv", ".json")
        with open(csv_path, newline='', encoding='utf-8') as csvfile:
            df = pd.read_csv(csvfile)
            df = df[['predictive_method', 'features', 'llm', '0.8 PVR', '0.9 PVR', '0.95 PVR', 'Area under\nARC', 'pair_name', 'predictive_method_features']]
            data = df.to_dict(orient='records')

        
        # Process the "llm" column to replace "__" with "/" and "_" with " "
        if 'llm' in df.columns:
            df['llm'] = df['llm'].astype(str).str.replace('__', '/', regex=False).str.replace('_', ' ', regex=False)

        # Also, rename 'Area under\nARC' to 'Area under ARC'
        if 'Area under\nARC' in df.columns:
            df = df.rename(columns={'Area under\nARC': 'Area under ARC'})
        # Truncate numbers to at most 3 digits after the decimal, remove trailing zeros
        for col in ['0.8 PVR', '0.9 PVR', '0.95 PVR', 'Area under ARC']:
            if col in df.columns:
                def truncate_3dec(x):
                    try:
                        val = float(x)
                        if pd.isna(val):
                            return x
                        s = f"{val:.3f}".rstrip('0').rstrip('.')
                        return s
                    except Exception:
                        return x
                df[col] = df[col].apply(truncate_3dec)
        data = df.to_dict(orient='records')
        
        with open(json_path, "w", encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"Processed {csv_path} -> {json_path}")

def render_template():
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template("index.html")

    with open(DATA_DIR / "mmlu_pro_assessor_results.json", "r") as f:
        leaderboard_ID = json.load(f)
    with open(DATA_DIR / "bbh_assessor_results.json", "r") as f:
        leaderboard_OOD = json.load(f)

    leaderboard_ID = {
        "name": "ID",
        "results": leaderboard_ID
    }
    leaderboard_OOD = {
        "name": "OOD",
        "results": leaderboard_OOD
    }

    html = template.render(
        leaderboard_ID=leaderboard_ID,
        leaderboard_OOD=leaderboard_OOD
    )
    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Rendered HTML to {OUTPUT_HTML}")

if __name__ == "__main__":
    # download_files() TODO temporarily disabled
    process_csv_to_json()
    render_template()