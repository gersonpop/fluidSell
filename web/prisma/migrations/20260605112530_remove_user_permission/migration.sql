/*
  Warnings:

  - The values [CLIENT] on the enum `RoleScope` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `PlatformUser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `PlatformUser` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `PlatformUser` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `PlatformUser` table. All the data in the column will be lost.
  - You are about to drop the column `isSuper` on the `PlatformUser` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `PlatformUser` table. All the data in the column will be lost.
  - You are about to drop the column `companyUserId` on the `UserRole` table. All the data in the column will be lost.
  - The primary key for the `st_Multidata` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `CompanyUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Module` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `modules` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[id_user_pk]` on the table `PlatformUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_email]` on the table `PlatformUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `PlatformUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,id_employee_fk]` on the table `PlatformUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dni,country_code]` on the table `PlatformUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[platform_user_id,roleId,company_id]` on the table `UserRole` will be added. If there are existing duplicate values, this will fail.
  - The required column `id_user_pk` was added to the `PlatformUser` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `updated_at` to the `PlatformUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_email` to the `PlatformUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `PlatformUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platform_user_id` to the `UserRole` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RoleScope_new" AS ENUM ('SU', 'Multicompany', 'Admin', 'User');
ALTER TABLE "Role" ALTER COLUMN "scope" TYPE "RoleScope_new" USING ("scope"::text::"RoleScope_new");
ALTER TYPE "RoleScope" RENAME TO "RoleScope_old";
ALTER TYPE "RoleScope_new" RENAME TO "RoleScope";
DROP TYPE "RoleScope_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_platformUserId_fkey";

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_createdById_fkey";

-- DropForeignKey
ALTER TABLE "CompanyUser" DROP CONSTRAINT "CompanyUser_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Module" DROP CONSTRAINT "Module_parentId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_companyUserId_fkey";

-- DropIndex
DROP INDEX "PlatformUser_email_key";

-- DropIndex
DROP INDEX "RolePermission_roleId_moduleId_key";

-- DropIndex
DROP INDEX "UserRole_companyUserId_roleId_key";

-- AlterTable
ALTER TABLE "PlatformUser" DROP CONSTRAINT "PlatformUser_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "email",
DROP COLUMN "id",
DROP COLUMN "isSuper",
DROP COLUMN "updatedAt",
ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "city_code" TEXT,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "country_code" TEXT,
ADD COLUMN     "country_iso" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "department_code" TEXT,
ADD COLUMN     "dni" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "id_employee_fk" SERIAL NOT NULL,
ADD COLUMN     "id_jefe_inm_fk" TEXT,
ADD COLUMN     "id_user_pk" TEXT NOT NULL,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "provider_user_id" TEXT,
ADD COLUMN     "sign" TEXT,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "theme" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_email" TEXT NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "password" DROP NOT NULL,
ADD CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id_user_pk");

-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "UserRole" DROP COLUMN "companyUserId",
ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "hash_permission" TEXT,
ADD COLUMN     "platform_user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "st_Multidata" DROP CONSTRAINT "st_Multidata_pkey",
ALTER COLUMN "Initials_PK" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "value" SET DATA TYPE TEXT,
ALTER COLUMN "type" SET DATA TYPE TEXT,
ALTER COLUMN "typeUse" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "st_Multidata_pkey" PRIMARY KEY ("value", "type");

-- DropTable
DROP TABLE "CompanyUser";

-- DropTable
DROP TABLE "Module";

-- DropTable
DROP TABLE "modules";

-- CreateTable
CREATE TABLE "Onboarding" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "last_name" TEXT,
    "phone_number" TEXT,
    "companyId" TEXT,
    "country_code" TEXT,
    "country_iso" TEXT,
    "department_code" TEXT,
    "city_code" TEXT,
    "dni" TEXT,
    "birth_date" TIMESTAMP(3),
    "gender" TEXT,
    "provider" TEXT,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modules" (
    "id" TEXT NOT NULL DEFAULT substr(md5((random()::text || clock_timestamp()::text)), 1, 24),
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "route" VARCHAR(255),
    "icon" TEXT,
    "sort_order" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "parent" TEXT NOT NULL DEFAULT '/',
    "scope_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" VARCHAR(40),
    "page_content" TEXT,
    "destination" VARCHAR(255),
    "actions" JSONB,

    CONSTRAINT "Modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermissionSecurity" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "backup" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermissionSecurity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "st_Country" (
    "prefix_area" INTEGER NOT NULL,
    "iso" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "st_Country_pkey" PRIMARY KEY ("iso")
);

-- CreateTable
CREATE TABLE "st_State" (
    "id_state" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "iso_country" TEXT NOT NULL,

    CONSTRAINT "st_State_pkey" PRIMARY KEY ("id_state")
);

-- CreateTable
CREATE TABLE "st_City" (
    "id_city" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "iso_country" TEXT NOT NULL,
    "state_id" INTEGER NOT NULL,

    CONSTRAINT "st_City_pkey" PRIMARY KEY ("id_city")
);

-- CreateIndex
CREATE UNIQUE INDEX "Onboarding_email_key" ON "Onboarding"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Onboarding_dni_country_code_key" ON "Onboarding"("dni", "country_code");

-- CreateIndex
CREATE UNIQUE INDEX "Modules_code_key" ON "Modules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermissionSecurity_roleId_key" ON "RolePermissionSecurity"("roleId");

-- CreateIndex
CREATE INDEX "st_State_iso_country_idx" ON "st_State"("iso_country");

-- CreateIndex
CREATE INDEX "st_City_iso_country_idx" ON "st_City"("iso_country");

-- CreateIndex
CREATE INDEX "st_City_state_id_idx" ON "st_City"("state_id");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_id_user_pk_key" ON "PlatformUser"("id_user_pk");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_user_email_key" ON "PlatformUser"("user_email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_username_key" ON "PlatformUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_companyId_id_employee_fk_key" ON "PlatformUser"("companyId", "id_employee_fk");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_dni_country_code_key" ON "PlatformUser"("dni", "country_code");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_moduleId_idx" ON "RolePermission"("roleId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_platform_user_id_roleId_company_id_key" ON "UserRole"("platform_user_id", "roleId", "company_id");

-- AddForeignKey
ALTER TABLE "PlatformUser" ADD CONSTRAINT "PlatformUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "PlatformUser"("id_user_pk") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "PlatformUser"("id_user_pk") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissionSecurity" ADD CONSTRAINT "RolePermissionSecurity_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id_user_pk") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "st_State" ADD CONSTRAINT "st_State_iso_country_fkey" FOREIGN KEY ("iso_country") REFERENCES "st_Country"("iso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "st_City" ADD CONSTRAINT "st_City_iso_country_fkey" FOREIGN KEY ("iso_country") REFERENCES "st_Country"("iso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "st_City" ADD CONSTRAINT "st_City_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "st_State"("id_state") ON DELETE RESTRICT ON UPDATE CASCADE;
