# Usamos una imagen oficial y ligera de Python
FROM python:3.11-slim

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos solo la carpeta del backend al directorio de trabajo
COPY backend/ .

# Actualizamos pip e instalamos las dependencias del requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Exponemos el puerto en el que Gunicorn se ejecutará
EXPOSE 3000

# El comando que se ejecutará cuando el contenedor inicie
# Usamos $PORT, Coolify reemplazará esto con el puerto correcto
CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:3000", "app:app"]