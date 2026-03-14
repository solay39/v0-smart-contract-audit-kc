FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y \
    curl git nodejs npm \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install solc-select
RUN pip install solc-select
RUN solc-select install 0.8.20 && solc-select use 0.8.20
RUN solc-select install 0.8.4
RUN solc-select install 0.8.19

# Install Slither
RUN pip install slither-analyzer==0.10.4

# Install Mythril
RUN pip install mythril==0.24.8

# Install Foundry
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:$PATH"
RUN foundryup

# Install Halmos (a16z Formal Verification)
# Halmos uses Z3 solver for symbolic bounded model checking
RUN pip install halmos z3-solver

# Python deps
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
