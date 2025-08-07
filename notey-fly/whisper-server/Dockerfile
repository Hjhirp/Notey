# whisper-server/Dockerfile
FROM debian:bullseye

# Install dependencies with performance optimizations
RUN apt-get update && apt-get install -y \
    build-essential cmake python3 python3-pip ffmpeg curl git \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /app

# Copy whisper.cpp and build it with optimizations
COPY whisper.cpp/ /app/whisper.cpp/
WORKDIR /app/whisper.cpp

# Debug: Check if cmake directory exists
RUN ls -la cmake/

# Create a minimal build-info.cmake if it doesn't exist
RUN if [ ! -f cmake/build-info.cmake ]; then \
    echo 'set(BUILD_NUMBER 0)' > cmake/build-info.cmake && \
    echo 'set(BUILD_COMMIT "docker-build")' >> cmake/build-info.cmake && \
    echo 'set(BUILD_COMPILER "unknown")' >> cmake/build-info.cmake && \
    echo 'set(BUILD_TARGET "unknown")' >> cmake/build-info.cmake; \
    fi

# Verify the file was created
RUN ls -la cmake/build-info.cmake
RUN cat cmake/build-info.cmake

# Build whisper.cpp with optimizations
RUN make clean || true
RUN make -j$(nproc) WHISPER_NO_AVX=1 WHISPER_NO_AVX2=1

# Download English base model
RUN mkdir -p models && \
    curl -L -o models/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin

# Go back and copy app
WORKDIR /app
COPY app.py ./
COPY requirements.txt ./

# Create downloads directory with proper permissions
RUN mkdir -p /app/downloads && chmod 777 /app/downloads

# Install Python dependencies with specific versions
RUN pip3 install --no-cache-dir --upgrade pip
RUN pip3 install --no-cache-dir fastapi==0.104.1 uvicorn[standard]==0.24.0 requests==2.31.0 psutil==5.9.6

# Verify installations
RUN python3 -c "import fastapi; print(f'FastAPI version: {fastapi.__version__}')"
RUN python3 -c "import uvicorn; print(f'Uvicorn version: {uvicorn.__version__}')"
RUN python3 -c "import requests; print(f'Requests version: {requests.__version__}')"

# Test that uvicorn module works
RUN python3 -m uvicorn --help

# Set environment variables for better performance
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=utf-8

EXPOSE 8080

# Use exec form for better signal handling
CMD ["python3", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
