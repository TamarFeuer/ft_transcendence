FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
# RUN npm ci --production
COPY src ./src
EXPOSE 3000
CMD ["node", "src/index.js"]