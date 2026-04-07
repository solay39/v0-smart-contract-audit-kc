FROM python:3.11-slim

# Install Coq
RUN apt-get update && apt-get install -y \
    coq \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install kevm-pyk (K Framework Python binding)
RUN pip install --no-cache-dir kevm-pyk flask gunicorn

WORKDIR /app
COPY server.py .

EXPOSE 8001
CMD ["gunicorn", "server:app", "--bind", "0.0.0.0:8001", "--workers", "2", "--timeout", "300"]
