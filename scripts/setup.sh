#!/bin/bash

echo "🚀 Configurando IDP Platform..."

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor instala Docker primero."
    exit 1
fi

# Verificar Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado. Por favor instala Docker Compose primero."
    exit 1
fi

# Levantar servicios
echo "📦 Levantando PostgreSQL y MinIO..."
docker-compose up -d

# Esperar a que PostgreSQL esté listo
echo "⏳ Esperando a que PostgreSQL esté listo..."
sleep 5

# Instalar dependencias
echo "📚 Instalando dependencias..."
npm install

# Generar Prisma Client
echo "🔧 Generando Prisma Client..."
npx prisma generate

# Ejecutar migraciones
echo "🗄️ Ejecutando migraciones de base de datos..."
npx prisma migrate dev --name init

echo "✅ Setup completado!"
echo ""
echo "📝 Próximos pasos:"
echo "1. Crea una GitHub OAuth App en: https://github.com/settings/applications/new"
echo "   - Homepage URL: http://localhost:3000"
echo "   - Authorization callback URL: http://localhost:3000/api/auth/callback/github"
echo ""
echo "2. Actualiza GITHUB_ID y GITHUB_SECRET en el archivo .env"
echo ""
echo "3. Ejecuta: npm run dev"
echo ""
echo "4. Abre http://localhost:3000"