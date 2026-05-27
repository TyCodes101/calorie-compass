-- Add durable native account provider links and backend-issued sessions.
CREATE TABLE "UserAuthProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAuthProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NativeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NativeSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAuthProvider_provider_providerSubject_key" ON "UserAuthProvider"("provider", "providerSubject");
CREATE INDEX "UserAuthProvider_userId_idx" ON "UserAuthProvider"("userId");

CREATE UNIQUE INDEX "NativeSession_tokenHash_key" ON "NativeSession"("tokenHash");
CREATE INDEX "NativeSession_userId_idx" ON "NativeSession"("userId");
CREATE INDEX "NativeSession_expiresAt_idx" ON "NativeSession"("expiresAt");
CREATE INDEX "NativeSession_revokedAt_idx" ON "NativeSession"("revokedAt");

ALTER TABLE "UserAuthProvider" ADD CONSTRAINT "UserAuthProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NativeSession" ADD CONSTRAINT "NativeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
