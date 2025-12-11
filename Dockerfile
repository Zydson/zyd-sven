FROM python:3.11-slim-bullseye
WORKDIR /app
RUN apt-get update && sed -i 's/ main/ main non-free/g' /etc/apt/sources.list && apt-get update && apt-get install -y --no-install-recommends ca-certificates wget git unrar && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/Zydson/zyd-sven.git .
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 888
CMD ["python", "main.py"]
