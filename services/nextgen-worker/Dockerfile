FROM python:3.11-slim

WORKDIR /worker

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker_app.py .

CMD ["celery", "-A", "worker_app.celery_app", "worker", "--loglevel=INFO"]
