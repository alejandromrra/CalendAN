# --- 1. Web (React + Tailwind) ---
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- 2. Servidor (Rust) ---
FROM rust:1-bookworm AS server
WORKDIR /app
# Compila primero las dependencias para aprovechar la caché
COPY server/Cargo.toml server/Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY server/migrations ./migrations
COPY server/src ./src
RUN touch src/main.rs && cargo build --release

# --- 3. Imagen final ---
FROM debian:bookworm-slim
# Los certificados TLS van incluidos en el binario (webpki-roots): no hace falta instalar nada
RUN useradd -r -u 10001 an
WORKDIR /app
COPY --from=server /app/target/release/an-server /app/an-server
COPY --from=web /app/dist /app/dist
ENV STATIC_DIR=/app/dist PORT=3001 RUST_LOG=an_server=info
USER an
EXPOSE 3001
CMD ["/app/an-server"]
