# Quick Start Guide

## Setup

### Option 1: Using `uv` (Recommended)

1. **Install dependencies:**
   ```powershell
   uv sync
   ```

2. **Run scraper:**
   ```powershell
   uv run python -m alma_scraper.cli --details
   ```

### Option 2: Using `pip`

1. **Create virtual environment:**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. **Install dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

3. **Run scraper:**
   ```powershell
   python -m alma_scraper.cli --details
   ```

## Usage

### Default: Informatik catalog (Recommended)

Scrape the Informatik course catalog (Gesamtverzeichnis Lehrveranstaltungen
Informatik) with course details:

```powershell
uv run python -m alma_scraper.cli --details
```

Each course detail includes a `categories` list — the module/study-program
codes (e.g. `INFO-INFO`, `INFO-BASIS`) from its "Module / Studiengänge" tab.

Output: `output/YYYY-MM-DD_HH-MM-SS/courses.json`

### Multiple semesters

Scrape every semester from a given label up to the most recent. Per-period
the scraper switches via ALMA's Semesterauswahl dropdown and rediscovers the
Informatik branch by title chain (the deep-path IDs differ between
semesters):

```powershell
uv run python -m alma_scraper.cli --details --from-semester "Sommer 2022"
```

Each course in the output gets `period_id` and `period_label` fields so you
can tell semesters apart. The output file is rewritten after every period,
so an interrupted run still leaves a usable file.

### List available semesters

```powershell
uv run python -m alma_scraper.cli --list-periods
```

### Quick Test (2 minutes)

Test scraping:

```powershell
uv run python -m alma_scraper.cli --details --max-runtime-seconds 120
```

### Full Catalog

Scrape entire university:

```powershell
uv run python -m alma_scraper.cli --full-catalog
```

### Watch Progress

In another terminal:

```powershell
Get-Content output/*/progress.json -Wait
```

## Output Structure

```
output/
├── 2024-01-15_14-30-45/
│   ├── courses.json          # Main data
│   └── progress.json         # Live progress
```

## Options

- `--details` - Fetch course details (recommended)
- `--from-semester LABEL` - Scrape every semester from LABEL up to current
- `--full-catalog` - Scrape entire catalog
- `--max-courses N` - Stop after N courses
- `--max-runtime-seconds N` - Stop after N seconds
- `--pretty` - Pretty-print JSON
- `--list-periods` - Print available period IDs and labels

For full help: `uv run python -m alma_scraper.cli --help`
