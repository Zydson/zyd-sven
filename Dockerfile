FROM python:3.11-slim-bullseye
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git unrar && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/Zydson/zyd-sven.git .
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd --create-home appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 777
CMD ["python", "main.py"]