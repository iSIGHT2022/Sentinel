FROM nvcr.io/nvidia/pytorch:24.01-py3

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p models

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
