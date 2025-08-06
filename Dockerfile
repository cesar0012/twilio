# Usar una imagen de Python más completa con herramientas de construcción
FROM python:3.11-slim

# Instalar herramientas de construcción necesarias
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    make \
    libssl-dev \
    libffi-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar todo el proyecto (frontend y backend)
COPY . .

# Instalar dependencias de Python
RUN pip install --no-cache-dir -r backend/requirements.txt

# Exponer puerto 5000
EXPOSE 5000

# Cambiar al directorio backend para ejecutar la aplicación
WORKDIR /app/backend

# Comando para iniciar la aplicación en HTTP normal
CMD ["python", "app.py"]