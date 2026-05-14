FROM node:18-alpine AS builder
WORKDIR /app
# we do install everything, including dev dependencies
# but only in the builder stage, which never ships.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# we only copy the built files to the production image, which is much smaller.
FROM nginx:stable-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80