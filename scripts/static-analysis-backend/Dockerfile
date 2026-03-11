# SOLAY39 Static Analysis Backend
# Deploy on Railway, Render, or any Docker host
# Runs real Slither, Mythril, and Foundry analysis

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    nodejs \
    npm \
    build-essential \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Foundry
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:${PATH}"
RUN foundryup

# Install Python tools (including Halmos for formal verification)
RUN pip install --no-cache-dir \
    slither-analyzer==0.10.4 \
    mythril==0.24.8 \
    solc-select==1.0.4 \
    crytic-compile==0.3.7 \
    halmos==0.1.14 \
    flask==3.0.0 \
    gunicorn==21.2.0

# Install Z3 solver (required for Halmos)
RUN pip install --no-cache-dir z3-solver==4.12.4.0

# Install multiple Solidity versions
RUN solc-select install 0.8.20 0.8.19 0.8.17 0.8.13 0.8.0 0.7.6 0.6.12
RUN solc-select use 0.8.20

# Create app directory
WORKDIR /app

# Copy analysis server
COPY analyze_server.py .

# Expose port
EXPOSE 8080

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "300", "--workers", "2", "analyze_server:app"]
