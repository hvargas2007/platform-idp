/*
  Warnings:

  - You are about to drop the column `templateId` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the `Deployment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Resource` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Template` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Deployment" DROP CONSTRAINT "Deployment_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Deployment" DROP CONSTRAINT "Deployment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_templateId_fkey";

-- DropForeignKey
ALTER TABLE "Resource" DROP CONSTRAINT "Resource_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_userId_fkey";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "templateId",
ADD COLUMN     "githubTemplateId" TEXT;

-- DropTable
DROP TABLE "Deployment";

-- DropTable
DROP TABLE "Resource";

-- DropTable
DROP TABLE "Template";

-- DropEnum
DROP TYPE "DeploymentStatus";

-- DropEnum
DROP TYPE "ResourceStatus";

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_githubTemplateId_fkey" FOREIGN KEY ("githubTemplateId") REFERENCES "GitHubTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
