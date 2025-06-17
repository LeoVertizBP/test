import { Decimal } from '@prisma/client/runtime/library';
import * as organizationService from '../../src/services/organizationService';
import * as organizationRepository from '../../src/repositories/organizationRepository';
import prisma from '../../src/utils/prismaClient'; // Import the actual prisma client to mock its properties

// Mock the repository module
jest.mock('../../src/repositories/organizationRepository');

// Mock the prisma client module and its specific methods/properties used in the service
jest.mock('../../src/utils/prismaClient', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn().mockImplementation(async (callback) => {
      // Simulate transaction by calling the callback with a mock tx object
      const mockTx = {
        audit_logs: {
          create: jest.fn().mockResolvedValue({ id: 'mock-audit-log-id' }),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          createMany: jest.fn(),
        },
        flags: {
          findMany: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }), // Default count to 0
        },
        // Add other models/methods if needed by the transaction callback
      };
      return callback(mockTx);
    }),
    audit_logs: {
        create: jest.fn().mockResolvedValue({ id: 'mock-audit-log-id' }),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        createMany: jest.fn(),
    },
    flags: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }), // Default count to 0
    },
    // Mock other direct prisma calls if necessary
  },
}));

// Mock console.log to suppress and potentially check TODO logs
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

// Define reusable mock data
const mockOrgId = 'org-uuid-123';
const mockUserId = 'user-uuid-456';
const mockOrganization = {
  id: mockOrgId,
  name: 'Test Org',
  auto_approval_threshold: new Decimal(0.85),
  auto_approve_compliant_enabled: true,
  auto_remediate_violation_enabled: false,
  // Add other necessary fields from the Organization type
  settings: {},
  auto_approval_action: 'pending_remediation',
  created_at: new Date(),
  updated_at: new Date(),
};

describe('Organization Service', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset specific mock implementations if needed
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
            audit_logs: {
                create: jest.fn().mockResolvedValue({ id: 'mock-audit-log-id' }),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                createMany: jest.fn(),
            },
            flags: {
                findMany: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
        };
        // Mock the repo call within the transaction mock
        (organizationRepository.updateOrganization as jest.Mock).mockResolvedValue(mockOrganization);
        return callback(mockTx);
    });
    (prisma.audit_logs.findFirst as jest.Mock).mockReset();
    (prisma.audit_logs.findMany as jest.Mock).mockReset();
    (prisma.flags.findMany as jest.Mock).mockReset();
    (prisma.flags.updateMany as jest.Mock).mockReset();
    (prisma.audit_logs.createMany as jest.Mock).mockReset();
  });

  // Restore console.log after all tests
  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  // --- Tests for updateAiBypassSettings ---
  describe('updateAiBypassSettings', () => {
    it('should update settings and create audit log when threshold is set', async () => {
        const threshold = 90;
        const autoApprove = true;
        const autoRemediate = false;
        const applyRetro = false;
        const expectedDbThreshold = new Decimal(0.90);

        // Mock the repository update function (called within the transaction mock)
        (organizationRepository.updateOrganization as jest.Mock).mockResolvedValue({
            ...mockOrganization,
            auto_approval_threshold: expectedDbThreshold,
            auto_approve_compliant_enabled: autoApprove,
            auto_remediate_violation_enabled: autoRemediate,
        });

        const result = await organizationService.updateAiBypassSettings(
            mockOrgId, mockUserId, threshold, autoApprove, autoRemediate, applyRetro
        );

        // Check repository call
        expect(organizationRepository.updateOrganization).toHaveBeenCalledWith(
            mockOrgId,
            {
                auto_approval_threshold: expectedDbThreshold,
                auto_approve_compliant_enabled: autoApprove,
                auto_remediate_violation_enabled: autoRemediate,
            },
            expect.anything() // Expect the transaction client object
        );

        // Check audit log creation (within the transaction mock)
        const mockTx = await (prisma.$transaction as jest.Mock).getMockImplementation()!(jest.fn());
        expect(mockTx.audit_logs.create).toHaveBeenCalledWith({
            data: {
                action: "AI Bypass Settings Updated",
                details: {
                    organizationId: mockOrgId,
                    newThreshold: threshold,
                    newAutoApproveCompliant: autoApprove,
                    newAutoRemediateViolation: autoRemediate,
                    applyRetroactively: applyRetro,
                },
                user_id: mockUserId,
            }
        });

        // Check result format
        expect(result.settings).toEqual({
            threshold: threshold,
            autoApproveCompliantEnabled: autoApprove,
            autoRemediateViolationEnabled: autoRemediate,
        });

        // Check that retroactive queue log was NOT called
        expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('retroactiveBypassQueue'));
    });

    it('should update settings, create audit log, and log TODO for retroactive queue when applyRetroactively is true', async () => {
        const threshold = 80;
        const autoApprove = true;
        const autoRemediate = true;
        const applyRetro = true;
        const expectedDbThreshold = new Decimal(0.80);

        (organizationRepository.updateOrganization as jest.Mock).mockResolvedValue({
            ...mockOrganization,
            auto_approval_threshold: expectedDbThreshold,
            auto_approve_compliant_enabled: autoApprove,
            auto_remediate_violation_enabled: autoRemediate,
        });

        await organizationService.updateAiBypassSettings(
            mockOrgId, mockUserId, threshold, autoApprove, autoRemediate, applyRetro
        );

        const mockTx = await (prisma.$transaction as jest.Mock).getMockImplementation()!(jest.fn());
        expect(mockTx.audit_logs.create).toHaveBeenCalledTimes(1); // Ensure audit log was created

        // Check that retroactive queue log WAS called
        expect(consoleLogSpy).toHaveBeenCalledWith(
            expect.stringContaining(`TODO: Add job to retroactiveBypassQueue for org ${mockOrgId} triggered by settingsLogId mock-audit-log-id`)
        );
    });

     it('should clear settings and create audit log when threshold is null', async () => {
        const threshold = null;
        const autoApprove = true; // These should be ignored
        const autoRemediate = true;
        const applyRetro = false;

        (organizationRepository.updateOrganization as jest.Mock).mockResolvedValue({
            ...mockOrganization,
            auto_approval_threshold: null,
            auto_approve_compliant_enabled: false, // Should be forced false
            auto_remediate_violation_enabled: false, // Should be forced false
        });

        const result = await organizationService.updateAiBypassSettings(
            mockOrgId, mockUserId, threshold, autoApprove, autoRemediate, applyRetro
        );

        expect(organizationRepository.updateOrganization).toHaveBeenCalledWith(
            mockOrgId,
            {
                auto_approval_threshold: null,
                auto_approve_compliant_enabled: false,
                auto_remediate_violation_enabled: false,
            },
            expect.anything()
        );

        const mockTx = await (prisma.$transaction as jest.Mock).getMockImplementation()!(jest.fn());
        expect(mockTx.audit_logs.create).toHaveBeenCalledWith({
            data: {
                action: "AI Bypass Settings Cleared",
                details: expect.objectContaining({ newThreshold: null, newAutoApproveCompliant: false, newAutoRemediateViolation: false }),
                user_id: mockUserId,
            }
        });

         expect(result.settings).toEqual({
            threshold: null,
            autoApproveCompliantEnabled: false,
            autoRemediateViolationEnabled: false,
        });

        expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('retroactiveBypassQueue'));
    });

    it('should throw error for invalid threshold', async () => {
        await expect(organizationService.updateAiBypassSettings(
            mockOrgId, mockUserId, 101, true, true, false
        )).rejects.toThrow('Threshold must be a number between 0 and 100, or null.');
         await expect(organizationService.updateAiBypassSettings(
            mockOrgId, mockUserId, -1, true, true, false
        )).rejects.toThrow('Threshold must be a number between 0 and 100, or null.');
    });
  });

  // --- Tests for getAiBypassSettings ---
  describe('getAiBypassSettings', () => {
    it('should return settings correctly when threshold is set', async () => {
        const dbThreshold = new Decimal(0.75);
        (organizationRepository.getOrganizationById as jest.Mock).mockResolvedValue({
            auto_approval_threshold: dbThreshold,
            auto_approve_compliant_enabled: true,
            auto_remediate_violation_enabled: false,
        });

        const settings = await organizationService.getAiBypassSettings(mockOrgId);

        expect(organizationRepository.getOrganizationById).toHaveBeenCalledWith(mockOrgId, {
            select: {
                auto_approval_threshold: true,
                auto_approve_compliant_enabled: true,
                auto_remediate_violation_enabled: true,
            }
        });
        expect(settings).toEqual({
            threshold: 75,
            autoApproveCompliantEnabled: true,
            autoRemediateViolationEnabled: false,
        });
    });

     it('should return settings correctly when threshold is null', async () => {
        (organizationRepository.getOrganizationById as jest.Mock).mockResolvedValue({
            auto_approval_threshold: null,
            auto_approve_compliant_enabled: false, // or null, should default to false
            auto_remediate_violation_enabled: null, // or false, should default to false
        });

        const settings = await organizationService.getAiBypassSettings(mockOrgId);

        expect(settings).toEqual({
            threshold: null,
            autoApproveCompliantEnabled: false,
            autoRemediateViolationEnabled: false,
        });
    });

     it('should throw error if organization not found', async () => {
        (organizationRepository.getOrganizationById as jest.Mock).mockResolvedValue(null);
        await expect(organizationService.getAiBypassSettings(mockOrgId)).rejects.toThrow('Organization not found.');
    });
  });

  // --- Tests for revertLastAiBypassBatch ---
  describe('revertLastAiBypassBatch', () => {
    const mockSettingsLogId = 'settings-log-uuid-1';
    const mockFlagUpdateLog1 = { details: { flag_id: 'flag-1' } };
    const mockFlagUpdateLog2 = { details: { flag_id: 'flag-2' } };
    const mockFlag1 = { id: 'flag-1' };
    const mockFlag2 = { id: 'flag-2' };

    it('should revert flags and create audit logs correctly', async () => {
        // Mock finding the latest settings log
        (prisma.audit_logs.findFirst as jest.Mock).mockResolvedValue({ id: mockSettingsLogId });
        // Mock finding linked flag update logs
        (prisma.audit_logs.findMany as jest.Mock).mockResolvedValue([mockFlagUpdateLog1, mockFlagUpdateLog2]);
        // Mock finding the flags themselves (both are revertible)
        (prisma.flags.findMany as jest.Mock).mockResolvedValue([mockFlag1, mockFlag2]);
        // Mock the updateMany result
         const mockTx = await (prisma.$transaction as jest.Mock).getMockImplementation()!(jest.fn());
        (mockTx.flags.updateMany as jest.Mock).mockResolvedValue({ count: 2 });


        const result = await organizationService.revertLastAiBypassBatch(mockOrgId, mockUserId);

        // Check finding the settings log
        expect(prisma.audit_logs.findFirst).toHaveBeenCalledWith(expect.objectContaining({
             where: {
                details: { path: ['organizationId'], equals: mockOrgId },
                action: { startsWith: "AI Bypass Settings" }
            },
            orderBy: { created_at: 'desc' },
        }));

        // Check finding flag update logs
        expect(prisma.audit_logs.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                triggering_event_log_id: mockSettingsLogId,
                action: { in: ["AI Bypass - Auto Closed", "AI Bypass - Auto Remediate"] }
            }
        }));

        // Check finding the flags
        expect(prisma.flags.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                id: { in: ['flag-1', 'flag-2'] },
                resolution_method: { in: ['AI_AUTO_CLOSE', 'AI_AUTO_REMEDIATE'] }
            }
        }));

        // Check the updateMany call within the transaction
        expect(mockTx.flags.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ['flag-1', 'flag-2'] } },
            data: {
                status: 'PENDING',
                resolution_method: null,
                reviewed_at: null,
                decision_made_at: null,
            }
        });

        // Check the createMany call for revert audit logs
        expect(mockTx.audit_logs.createMany).toHaveBeenCalledWith({
            data: [
                expect.objectContaining({ action: "AI Bypass Reverted", user_id: mockUserId, details: { flag_id: 'flag-1', reverted_from_setting_event: mockSettingsLogId }, triggering_event_log_id: mockSettingsLogId }),
                expect.objectContaining({ action: "AI Bypass Reverted", user_id: mockUserId, details: { flag_id: 'flag-2', reverted_from_setting_event: mockSettingsLogId }, triggering_event_log_id: mockSettingsLogId }),
            ]
        });

        // Check the final count
        expect(result).toEqual({ revertedCount: 2 });
    });

     it('should return 0 if no settings log found', async () => {
        (prisma.audit_logs.findFirst as jest.Mock).mockResolvedValue(null);
        const result = await organizationService.revertLastAiBypassBatch(mockOrgId, mockUserId);
        expect(result).toEqual({ revertedCount: 0 });
        expect(prisma.audit_logs.findMany).not.toHaveBeenCalled();
        expect(prisma.flags.findMany).not.toHaveBeenCalled();
    });

     it('should return 0 if no flag update logs found for the settings log', async () => {
        (prisma.audit_logs.findFirst as jest.Mock).mockResolvedValue({ id: mockSettingsLogId });
        (prisma.audit_logs.findMany as jest.Mock).mockResolvedValue([]); // No linked logs
        const result = await organizationService.revertLastAiBypassBatch(mockOrgId, mockUserId);
        expect(result).toEqual({ revertedCount: 0 });
        expect(prisma.flags.findMany).not.toHaveBeenCalled();
    });

     it('should return 0 if flags found are not in a revertible state', async () => {
        (prisma.audit_logs.findFirst as jest.Mock).mockResolvedValue({ id: mockSettingsLogId });
        (prisma.audit_logs.findMany as jest.Mock).mockResolvedValue([mockFlagUpdateLog1]);
        (prisma.flags.findMany as jest.Mock).mockResolvedValue([]); // Flag exists but not AI_AUTO_*
        const result = await organizationService.revertLastAiBypassBatch(mockOrgId, mockUserId);
        expect(result).toEqual({ revertedCount: 0 });
         const mockTx = await (prisma.$transaction as jest.Mock).getMockImplementation()!(jest.fn());
        expect(mockTx.flags.updateMany).not.toHaveBeenCalled();
        expect(mockTx.audit_logs.createMany).not.toHaveBeenCalled();
    });
  });
});
