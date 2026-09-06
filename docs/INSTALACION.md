# Instalación local

## Requisitos

- Docker Engine 26 o superior y Docker Compose v2.
- 4 GB de RAM libres como mínimo; 8 GB recomendados.
- Puerto 8080 disponible.

## Puesta en marcha

1. Crear la configuración local:

   ~~~bash
   cp .env.example .env
   ~~~

2. Reemplazar al menos:

   - POSTGRES_PASSWORD
   - JWT_ACCESS_SECRET
   - JWT_REFRESH_SECRET
   - CSRF_SECRET

   Los tres secretos deben ser aleatorios, distintos entre sí y de 48 caracteres
   o más. Por ejemplo, generar cada uno por separado con `openssl rand -base64 64`.

3. Levantar la solución:

   ~~~bash
   docker compose up --build -d
   docker compose ps
   ~~~

4. Verificar:

   ~~~bash
   curl http://localhost:8080/api/v1/health
   ~~~

5. Ingresar en http://localhost:8080.

## Desarrollo sin Docker

Se necesita Node.js 22 y un PostgreSQL accesible.

~~~bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
~~~

Para desarrollo local, ajustar DATABASE_URL, FRONTEND_URL y
NEXT_PUBLIC_API_URL.

La configuración de ejemplo autoriza tanto `localhost:3000` (desarrollo) como
`localhost:8080` (Docker). No conservar esos orígenes en producción.

## Acceso social local

El frontend muestra Google y Microsoft/Hotmail desde el inicio. Para completar
el flujo real se deben cargar las credenciales OAuth descriptas en
[PRODUCCION.md](PRODUCCION.md). Sin esas credenciales, los botones informan que
la integración está preparada y el acceso demo tradicional sigue disponible.

## Reinicio y logs

~~~bash
docker compose restart backend
docker compose logs -f --tail=200 backend
docker compose logs -f --tail=200 postgres
~~~

## Detener

~~~bash
docker compose down
~~~

No usar **docker compose down -v** salvo que se busque eliminar de forma
intencional la base y los documentos persistentes.
