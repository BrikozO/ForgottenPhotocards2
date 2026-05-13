# Reverse-proxy nginx

Sits in front of `frontend` (static SPA) and `backend` (FastAPI). Two
configurations, two Dockerfiles:

| Build               | Config       | Ports     | Notes                                |
| ------------------- | ------------ | --------- | ------------------------------------ |
| `Dockerfile.dev`    | `dev.conf`   | 80        | Plain HTTP. Used by `docker-compose.yml`. |
| `Dockerfile.prod`   | `prod.conf`  | 80 + 443  | 80 → 301 to HTTPS, 443 with TLS.    |

## Prod certificates

The prod image expects two files mounted into the container:

```
/etc/nginx/certs/fullchain.pem
/etc/nginx/certs/privkey.pem
```

`docker-compose.prod.yml` mounts `./nginx/certs` from the host (read-only).
Drop the cert pair into that directory before `docker compose up`.

For Let's Encrypt the typical flow is:

```
sudo certbot certonly --webroot -w /var/www/certbot -d example.com
cp /etc/letsencrypt/live/example.com/fullchain.pem ./nginx/certs/
cp /etc/letsencrypt/live/example.com/privkey.pem  ./nginx/certs/
```

The ACME webroot `/var/www/certbot` is also exposed by `prod.conf` (for
`http-01` renewals without restarts) — mount the same host directory if you
plan to use certbot.

## Running

```bash
# dev
docker compose up --build

# prod (after placing certs)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```
