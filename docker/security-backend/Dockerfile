# Solay39 Security Backend
# Foundry + Slither + Mythril + solc
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.foundry/bin:/root/.local/bin:${PATH}"

# System dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    build-essential \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

# Install solc (multiple versions)
RUN add-apt-repository ppa:ethereum/ethereum -y && \
    apt-get update && \
    apt-get install -y solc && \
    pip3 install solc-select && \
    solc-select install 0.8.20 0.8.19 0.8.17 0.7.6 0.6.12 && \
    solc-select use 0.8.20

# Install Foundry
RUN curl -L https://foundry.paradigm.xyz | bash && \
    /root/.foundry/bin/foundryup

# Install Slither
RUN pip3 install slither-analyzer

# Install Mythril
RUN pip3 install mythril

# Install Echidna (optional - for property-based fuzzing)
RUN curl -L https://github.com/crytic/echidna/releases/download/v2.2.3/echidna-2.2.3-x86_64-linux.tar.gz | tar xz -C /usr/local/bin

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Create temp directories for analysis and run the service without root privileges
RUN useradd --create-home --shell /usr/sbin/nologin audit && \
    mkdir -p /tmp/contracts /tmp/reports && \
    chown -R audit:audit /app /tmp/contracts /tmp/reports
USER audit

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Runtime defaults are reinforced by docker-compose.security.yml.
# Keep the process unprivileged and fail closed when the API key is absent.
ENV NODE_ENV=production
CMD ["node", "--disable-proto=throw", "server.js"]
