# Use a lightweight, official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables to keep Python from writing pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY WebSite/requirements.txt /app/requirements.txt

# Install dependencies and download necessary NLTK corpora for text preprocessing
RUN pip install --no-cache-dir -r /app/requirements.txt && \
    python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet')"

# Copy the rest of the application source code into the container
COPY . /app/

# Expose the port the Flask app runs on
EXPOSE 5000

# Start the Flask API server
CMD ["python", "WebSite/api.py"]
