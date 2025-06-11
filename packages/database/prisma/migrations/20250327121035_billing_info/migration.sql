-- CreateTable
CREATE TABLE "billing_info" (
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" VARCHAR NOT NULL,
    "customerId" VARCHAR NOT NULL,
    "addressId" VARCHAR NOT NULL,
    "businessId" VARCHAR NOT NULL,
    "productId" VARCHAR NOT NULL,
    "subscriptionId" VARCHAR NOT NULL,
    "subscriptionStatus" VARCHAR NOT NULL,
    "subscriptionEndDate" DATE,
    "subscriptionNextBilledAt" DATE NOT NULL,
    "subscriptionUpdateUrl" VARCHAR,
    "subscriptionCancelUrl" VARCHAR,

    CONSTRAINT "billing_info_pkey" PRIMARY KEY ("organizationId")
);

-- AddForeignKey
ALTER TABLE "billing_info" ADD CONSTRAINT "billing_info_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
