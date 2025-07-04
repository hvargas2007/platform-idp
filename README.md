# IDP Platform - Internal Developer Portal

Un portal centralizado para automatizar la creación de infraestructura con Terraform y estandarizar proyectos en GitHub.

## Características

- **Infraestructura como Código**: Despliega recursos en AWS, Azure o GCP usando Terraform.
- **Automatización GitHub**: Crea repositorios, configura CI/CD y protege branches automáticamente.
- **Templates Reutilizables**: Biblioteca de templates preconfigurados con buenas prácticas.
- **Gestión de Deployments**: Visualiza y gestiona todos tus deployments desde un solo lugar.

## Requisitos

- Node.js 18+
- Docker y Docker Compose
- Cuenta de GitHub
- Token de GitHub con permisos de repositorio

## Instalación

1. **Clona el repositorio**

```bash
git clone <tu-repo>
cd idp-platform
```

2. **Ejecuta el script de setup**

```bash
./scripts/setup.sh
```

3. **Crea una GitHub OAuth App**

- Ve a [https://github.com/settings/applications/new](https://github.com/settings/applications/new)
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

4. **Actualiza las variables de entorno**

- Copia el Client ID y Client Secret de tu OAuth App.
- Actualiza `GITHUB_ID` y `GITHUB_SECRET` en el archivo `.env`.

5. **Inicia el servidor de desarrollo**

```bash
npm run dev
```

6. **Abre la aplicación**

- Navega a [http://localhost:3000](http://localhost:3000)

## Arquitectura

```
IDP Platform
├── Frontend (Next.js 14)
│   └── Dashboard + Template Gallery + Deployment Manager
├── Backend (Next.js API Routes)
│   └── GitHub Integration + Terraform Runner + Template Engine
├── Storage
│   ├── PostgreSQL (metadata)
│   └── MinIO (artifacts)
```

## Uso

### Crear un nuevo proyecto

1. Inicia sesión con tu cuenta de GitHub.
2. Ve a "Nuevo Proyecto".
3. Selecciona un template (ej: "API REST con Node.js").
4. Configura los parámetros.
5. Haz clic en "Crear".

El sistema automáticamente:

- Crea un repositorio en GitHub.
- Configura GitHub Actions para desplegar la infraestructura.
- Te da acceso a los recursos creados.

## Templates disponibles

- **API REST**: Node.js + Express + PostgreSQL
- **Frontend SPA**: React + Vite + S3 + CloudFront
- **Microservicio**: Go + Docker + Kubernetes
- **Data Pipeline**: Python + Airflow + S3

## Estructura del proyecto

```
idp-platform/
├── pages/               # Vistas del frontend en Next.js
├── components/          # Componentes React reutilizables
├── lib/                 # Utilidades y clientes API
├── github/              # Clientes de GitHub API
├── terraform/           # Templates de infraestructura
├── scripts/             # Scripts de instalación y helpers
├── public/              # Assets, migraciones, etc.
├── .env.example         # Variables de entorno de ejemplo
└── README.md            # Este archivo
```


## 👤 Autor

📧 hermesvargas200720@gmail.com