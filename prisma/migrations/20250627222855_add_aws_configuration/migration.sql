-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "awsBackend" TEXT,
ADD COLUMN     "awsRegion" TEXT,
ADD COLUMN     "awsRole" TEXT,
ADD COLUMN     "projectName" TEXT,
ADD COLUMN     "usernameGithub" TEXT;
