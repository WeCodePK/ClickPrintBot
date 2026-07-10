FROM node:24-bookworm-slim
WORKDIR /usr/src/app

# WhatsApp session (LocalAuth) is persisted here; mount a volume at /data.
VOLUME /data

# Runtime libraries required by the Chromium that puppeteer (a whatsapp-web.js
# dependency) drives.
RUN apt-get update && apt-get install -y \
  gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 \
  libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \
  libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
  libxss1 libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install deps first for better layer caching. npm install lets puppeteer
# download its matching Chromium build into the image.
COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

# HTTP gateway (NotifyBot `/send` API).
EXPOSE 3000

CMD ["node", "src/index.js"]
