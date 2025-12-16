# Base Python image for Python services
FROM python:3.12-slim AS base

WORKDIR /app

# Install poetry
RUN pip install --no-cache-dir poetry

# Copy poetry files
COPY libs/python/pyproject.toml ./libs/python/

# Configure poetry
RUN poetry config virtualenvs.create false

# Development stage
FROM base AS development
RUN poetry install
CMD ["poetry", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production stage
FROM base AS production
RUN poetry install --no-dev
COPY . .
CMD ["poetry", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

