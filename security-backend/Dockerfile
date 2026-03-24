# SOLAY39 Security Analysis Backend
# FastAPI + Slither + Mythril + Foundry + WeasyPrint
# Deploy on Railway with: railway up

FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.foundry/bin:/root/.local/bin:${PATH}"

# System dependencies + WeasyPrint dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    software-properties-common \
    # WeasyPrint dependencies
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    libcairo2 \
    libglib2.0-0 \
    fonts-dejavu-core \
    fonts-liberation \
    fonts-noto-color-emoji \
    # Solidity compiler
    && rm -rf /var/lib/apt/lists/*

# Install Rust (needed for some Python packages)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install solc-select and multiple solc versions
RUN pip install solc-select && \
    solc-select install 0.8.20 0.8.19 0.8.17 0.7.6 0.6.12 && \
    solc-select use 0.8.20

# Install Foundry
RUN curl -L https://foundry.paradigm.xyz | bash && \
    /root/.foundry/bin/foundryup

# Install Halmos (a16z formal verification)
RUN pip install halmos

# Create app directory
WORKDIR /app

# Copy requirements and install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Create temp directories for analysis
RUN mkdir -p /tmp/contracts /tmp/reports

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
