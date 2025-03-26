# Stage 1: Install Node dependencies
FROM node:23.10.0 AS node-builder
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts

# Stage 2: Install Python dependencies
FROM python:3.11-slim AS python-builder
WORKDIR /app
COPY embedding_service/requirements.txt ./embedding_service/requirements.txt
RUN pip install --upgrade pip && pip install -r embedding_service/requirements.txt

# Stage 3: Final image
FROM node:23.10.0
WORKDIR /app
COPY --from=node-builder /app /app
COPY --from=python-builder /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
