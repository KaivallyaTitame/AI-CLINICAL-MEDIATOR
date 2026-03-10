-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientCase" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "diagnosis" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "comorbidities" TEXT[],
    "medications" TEXT[],
    "labResults" JSONB NOT NULL,
    "imagingSummary" TEXT,
    "biopsyResults" TEXT,
    "riskScores" JSONB NOT NULL,
    "specialistViews" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "meetingType" TEXT NOT NULL,
    "uploads" JSONB,
    "templateSlug" TEXT,
    "agentResponses" JSONB,
    "consensusReport" JSONB,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "doctorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_email_key" ON "Doctor"("email");

-- AddForeignKey
ALTER TABLE "PatientCase" ADD CONSTRAINT "PatientCase_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
