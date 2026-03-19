/*
  Warnings:

  - A unique constraint covering the columns `[patientId]` on the table `PatientCase` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PatientCase" ADD COLUMN     "icd10Code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PatientCase_patientId_key" ON "PatientCase"("patientId");
