# Usamos una imagen oficial y ligera de Python
FROM python:3.11-slim

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos TODO el contenido del proyecto (backend y frontend) al contenedor
COPY . .

# Actualizamos pip e instalamos las dependencias de Python que están en backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Exponemos el puerto en el que Gunicorn se ejecutará
EXPOSE 3000

# El comando que se ejecutará cuando el contenedor inicie
# Le decimos a Gunicorn que trabaje DESDE la carpeta backend
CMD ["gunicorn", "--chdir", "backend", "--workers", "4", "--bind", "0.0.0.0:3000", "app:app"]