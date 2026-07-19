// Jest setup file to set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Helper function to create properly typed mocks
const createMockFn = () => {
  return jest.fn();
};

// Mock storage service globally - use factory function to avoid hoisting issues
const storageServiceMock = {
  storeFile: jest.fn(),
  retrieveFile: jest.fn(),
  deleteFile: jest.fn(),
  generateSignedUrl: jest.fn(),
};

jest.mock('../src/storage/storage.service', () => storageServiceMock);

// Export the mocks so test files can use them
export const mockStoreFile = storageServiceMock.storeFile;
export const mockRetrieveFile = storageServiceMock.retrieveFile;
export const mockDeleteFile = storageServiceMock.deleteFile;
export const mockGenerateSignedUrl = storageServiceMock.generateSignedUrl;

// Mock Prisma client with comprehensive delegate coverage
jest.mock('../src/db/client', () => {
  const mockPrisma = {
    // Patient model
    patient: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
      deleteMany: createMockFn(),
      upsert: createMockFn(),
    },
    // PatientNote model
    patientNote: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
      deleteMany: createMockFn(),
      upsert: createMockFn(),
    },
    // PatientTimelineEvent model
    patientTimelineEvent: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // PrivacyRequest model
    privacyRequest: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // PrivacyRequestEvent model
    privacyRequestEvent: {
      create: createMockFn(),
      findMany: createMockFn(),
    },
    // ConsentRecord model
    consentRecord: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // CommunicationPreference model
    communicationPreference: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
      upsert: createMockFn(),
    },
    // CommunicationLog model
    communicationLog: {
      create: createMockFn(),
      findMany: createMockFn(),
      findUnique: createMockFn(),
      count: createMockFn(),
    },
    // RetentionPolicy model
    retentionPolicy: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // RetentionRun model
    retentionRun: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // RetentionCleanup model
    retentionCleanup: {
      create: createMockFn(),
      findMany: createMockFn(),
    },
    // RetentionCleanupJob model
    retentionCleanupJob: {
      create: createMockFn(),
      findMany: createMockFn(),
      findUnique: createMockFn(),
      update: createMockFn(),
    },
    // AuditLog model
    auditLog: {
      create: createMockFn(),
      findMany: createMockFn(),
      findUnique: createMockFn(),
      count: createMockFn(),
      deleteMany: createMockFn(),
    },
    // AdminAuditLog model
    adminAuditLog: {
      create: createMockFn(),
      findMany: createMockFn(),
      findUnique: createMockFn(),
      count: createMockFn(),
      deleteMany: createMockFn(),
    },
    // SecurityEvent model
    securityEvent: {
      create: createMockFn(),
      findMany: createMockFn(),
      findUnique: createMockFn(),
      deleteMany: createMockFn(),
      count: createMockFn(),
    },
    // DestructiveActionLog model
    destructiveActionLog: {
      create: createMockFn(),
      findMany: createMockFn(),
      findUnique: createMockFn(),
      count: createMockFn(),
    },
    // Staff model
    staffMember: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // SystemSetting model
    systemSetting: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // Invoice model
    invoice: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // Communication model
    // Appointment model
    appointment: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
      deleteMany: createMockFn(),
    },
    communication: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // Document model
    document: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // DocumentEvent model
    documentEvent: {
      create: createMockFn(),
      findMany: createMockFn(),
    },
    // Payment model
    payment: {
      create: createMockFn(),
      findUnique: createMockFn(),
      findMany: createMockFn(),
      findFirst: createMockFn(),
      count: createMockFn(),
      update: createMockFn(),
      delete: createMockFn(),
    },
    // ClinicSettings model
    clinicSettings: {
      findMany: createMockFn(),
      findUnique: createMockFn(),
      update: createMockFn(),
    },
    // DeniedAction model
    deniedAction: {
      create: createMockFn(),
      findMany: createMockFn(),
      count: createMockFn(),
    },
    // Transaction mock
    $transaction: createMockFn(),
    // Disconnect mock
    $disconnect: createMockFn(),
    $connect: createMockFn(),
    $use: createMockFn(),
    $on: createMockFn(),
  };

  return {
    prisma: mockPrisma,
  };
});
