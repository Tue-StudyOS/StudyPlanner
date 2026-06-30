# Setup Instructions

## Option 1: Using `uv` (Recommended)

1. **Install dependencies:**
   ```powershell
   uv sync
   ```

2. **Run scraper:**
   ```powershell
   uv run python -m alma.cli --details
   ```

## Option 2: Using `pip` (Virtual Environment)

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
   python -m alma.cli --details
   ```

## Output

Results are saved to: `output/YYYY-MM-DD_HH-MM-SS/courses.json`

See `QUICKSTART.md` for more examples and options.
