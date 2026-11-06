# Solay39 Slither worker
# Build:  docker build -t solay39-slither-worker slither-worker
# Run:    docker run -p 8080:8080 -e SLITHER_WORKER_API_KEY=... solay39-slither-worker

# ── Bundled Solidity libraries (OpenZeppelin v5 and v4.9) ──────────────
FROM node:20-slim AS libs
WORKDIR /opt/solidity-libs
RUN mkdir oz5 oz4 \
 && cd oz5 && npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund \
      @openzeppelin/contracts@5.4.0 @openzeppelin/contracts-upgradeable@5.4.0 \
 && cd ../oz4 && npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund \
      @openzeppelin/contracts@4.9.6 @openzeppelin/contracts-upgradeable@4.9.6

# ── Worker ─────────────────────────────────────────────────────────────
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    SLITHER_LIBS_DIR=/opt/solidity-libs PORT=8080

RUN useradd --create-home --uid 10001 worker
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

USER worker
# Pre-install the most used compilers; others are downloaded on demand.
RUN solc-select install 0.8.30 0.8.28 0.8.26 0.8.24 0.8.20 0.8.19 0.8.17 0.8.13 0.8.9 0.8.4 0.7.6 0.6.12 0.5.17 0.4.26 \
 && solc-select use 0.8.28

COPY --from=libs --chown=worker /opt/solidity-libs /opt/solidity-libs
COPY --chown=worker app.py .

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8080\")}/health',timeout=5)"
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1"]
