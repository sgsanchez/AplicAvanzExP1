# =====================================================================
#  TurnoConnect - Imagen de la aplicación (opcional, perfil "full")
#  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
# =====================================================================
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia primero los manifiestos para aprovechar la caché de capas
COPY package*.json ./

# Instala solo dependencias de producción
RUN npm install --omit=dev

# Copia el resto del código fuente
COPY . .

# Puerto REST/WebSocket, TCP y UDP
EXPOSE 3000
EXPOSE 5000
EXPOSE 5001/udp

# Usuario sin privilegios
USER node

CMD ["node", "src/server.js"]
