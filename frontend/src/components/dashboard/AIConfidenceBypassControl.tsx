'use client';

import React, { useState, useEffect, useCallback } from 'react';
// Assuming dashboardService is updated with new functions/payloads
import { dashboardService, AIBypassAnalysisData, SetAIBypassThresholdPayload, AIBypassSettingsData } from '@/services/dashboardService';
import { debounce } from 'lodash';

// Basic Modal Component (remains the same)
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4">{title}</h3>
        <div className="mb-6">{children}</div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-primary"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};


const AIConfidenceBypassControl: React.FC = () => {
  const [threshold, setThreshold] = useState<number | null>(null); // Initialize as null, fetch actual value
  const [autoApproveCompliant, setAutoApproveCompliant] = useState<boolean>(false);
  const [autoRemediateViolation, setAutoRemediateViolation] = useState<boolean>(false);
  const [applyRetroactively, setApplyRetroactively] = useState<boolean>(false);

  const [currentSettings, setCurrentSettings] = useState<AIBypassSettingsData | null>(null); // Store fetched settings
  const [analysisData, setAnalysisData] = useState<AIBypassAnalysisData | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<boolean>(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true); // Start loading settings
  const [error, setError] = useState<string | null>(null);

  // State for modals
  const [modalAction, setModalAction] = useState<'set' | 'clear' | 'revert' | null>(null);

  // State for API operations
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);


  // --- Fetch Current Settings ---
  const fetchCurrentSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    setError(null); // Clear previous errors
    setSubmitError(null);
    setSubmitSuccessMessage(null);
    try {
      // Assuming dashboardService.getAiBypassSettings exists
      const response = await dashboardService.getAiBypassSettings();
      const settings = response.data;
      setCurrentSettings(settings);
      // If threshold from backend is null (i.e., cleared/disabled), display 0, otherwise use fetched value.
      // The actual 'disabled' state is still known via currentSettings.threshold === null
      setThreshold(settings.threshold === null ? 0 : settings.threshold); 
      setAutoApproveCompliant(settings.autoApproveCompliantEnabled);
      setAutoRemediateViolation(settings.autoRemediateViolationEnabled);
      console.log('Fetched current settings:', settings);
    } catch (err: any) {
      console.error('Error fetching current AI bypass settings:', err);
      setError(err.response?.data?.message || 'Failed to load current bypass settings.');
      // Reset to a default display state on error
      setThreshold(0); // Display 0 on error
      setAutoApproveCompliant(false);
      setAutoRemediateViolation(false);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  // --- Fetch Analysis Data (Debounced) ---
  const debouncedFetchAnalysis = useCallback(
    debounce(async (currentThresholdValue: number | null) => {
      if (currentThresholdValue === null) {
        setAnalysisData(null); // Clear analysis if threshold is null
        return;
      }
      setIsLoadingAnalysis(true);
      setError(null); // Clear general error, focus on analysis loading
      try {
        // Assuming dashboardService.getAIBypassAnalysis exists and handles number threshold
        const response = await dashboardService.getAIBypassAnalysis(currentThresholdValue);
        setAnalysisData(response.data);
      } catch (err: any) {
        console.error('Error fetching AI bypass analysis:', err);
        setError(err.response?.data?.message || 'Failed to load AI bypass analysis data.');
        setAnalysisData(null);
      } finally {
        setIsLoadingAnalysis(false);
      }
    }, 500),
    []
  );

  // --- Effects ---
  // Fetch settings on mount
  useEffect(() => {
    fetchCurrentSettings();
  }, [fetchCurrentSettings]);

  // Fetch analysis when threshold changes (and is not null)
  useEffect(() => {
    console.log('Threshold changed to:', threshold);
    if (threshold !== null) {
      debouncedFetchAnalysis(threshold);
    } else {
      setAnalysisData(null); // Clear analysis if threshold becomes null
    }
  }, [threshold, debouncedFetchAnalysis]);


  // --- Handlers ---
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(event.target.value);
    setThreshold(newValue);
  };

  const handleSetThresholdClick = () => {
    setSubmitError(null);
    setSubmitSuccessMessage(null);
    setModalAction('set');
  };

  const handleClearSettingsClick = () => {
    setSubmitError(null);
    setSubmitSuccessMessage(null);
    setModalAction('clear');
  };

  const handleRevertClick = () => {
    setSubmitError(null);
    setSubmitSuccessMessage(null);
    setModalAction('revert');
  };

  const handleConfirmAction = async () => {
    if (!modalAction) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccessMessage(null);
    let successMsg = '';

    try {
      if (modalAction === 'set') {
        if (threshold === null) {
          throw new Error("Cannot set threshold when it's null. Use Clear/Disable instead.");
        }
        // Assuming dashboardService.setAIBypassThreshold payload is updated
        const payload: SetAIBypassThresholdPayload = {
          threshold,
          autoApproveCompliant,
          autoRemediateViolation,
          applyRetroactively
        };
        const response = await dashboardService.setAIBypassThreshold(payload);
        successMsg = response.data.message || 'AI bypass settings updated successfully.';
        setApplyRetroactively(false); // Reset retroactive checkbox after submission
        await fetchCurrentSettings(); // Re-fetch settings to confirm update
      } else if (modalAction === 'clear') {
        // Assuming dashboardService.clearAIBypassSettings exists and calls the POST endpoint with null
        // Or update setAIBypassThreshold to handle null threshold correctly
        const payload: SetAIBypassThresholdPayload = {
          threshold: null,
          autoApproveCompliant: false, // Explicitly set to false when clearing
          autoRemediateViolation: false,
          applyRetroactively: false
        };
        const response = await dashboardService.setAIBypassThreshold(payload); // Use the same endpoint
        successMsg = response.data.message || 'AI bypass settings cleared successfully.';
        await fetchCurrentSettings(); // Re-fetch settings
      } else if (modalAction === 'revert') {
        // Assuming dashboardService.revertLastAiBypassBatch exists
        const response = await dashboardService.revertLastAiBypassBatch();
        successMsg = response.data.message || 'Revert action triggered successfully.';
        // Reverting doesn't change settings, no need to re-fetch settings, but maybe analysis?
        // For now, just show success message.
      }
      setSubmitSuccessMessage(successMsg);
    } catch (err: any) {
      console.error(`Error during action '${modalAction}':`, err);
      setSubmitError(err.response?.data?.message || `Failed to ${modalAction} AI bypass settings.`);
    } finally {
      setIsSubmitting(false);
      setModalAction(null); // Close modal
    }
  };

  const closeModal = () => {
    setModalAction(null);
  };

  // Determine if the form state differs from the fetched current settings
  // Consider the displayed threshold (e.g., 0) vs actual backend threshold (null)
  const actualBackendThreshold = currentSettings?.threshold;
  const displayedThresholdRepresentsChange = threshold !== null && (actualBackendThreshold === null ? threshold !== 0 : threshold !== actualBackendThreshold);

  const hasChanges = currentSettings !== null && (
    displayedThresholdRepresentsChange ||
    (threshold !== null && actualBackendThreshold === null) || // Enabling from a disabled state is a change
    autoApproveCompliant !== currentSettings.autoApproveCompliantEnabled ||
    autoRemediateViolation !== currentSettings.autoRemediateViolationEnabled
  );

  // "Save Settings" should be enabled if there are changes OR if the current setting is "disabled" (null) 
  // and the user has entered a valid threshold (even if it's the default display of 0, they might want to enable it at 0).
  // A threshold of null itself cannot be "set" via save, only via clear.
  const canSetThreshold = threshold !== null; // User must input a number to enable "Save"

  return (
    <div className="card p-6">
      <h3 className="text-h3 font-medium mb-4">AI Confidence Bypass Analysis & Control</h3>

      {isLoadingSettings && (
        <div className="text-center text-text-secondary py-4">Loading settings...</div>
      )}

      {error && !isLoadingSettings && (
        <div className="bg-error bg-opacity-10 p-3 rounded-md text-error mb-4">
          Error loading settings: {error}
        </div>
      )}

      {!isLoadingSettings && !error && (
        <>
          {/* Threshold Controls */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="confidenceThreshold" className="block text-sm font-medium text-text-primary">
                Confidence Threshold: <span className="font-bold">{currentSettings?.threshold === null ? 'Disabled' : `${threshold}%`}</span>
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={threshold === null ? '' : threshold} // Display current threshold state, allow empty for typing
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setThreshold(null); // Allow temporarily null while typing, but "Save" will be disabled
                    } else {
                      const numVal = Number(val);
                      if (!isNaN(numVal) && numVal >= 0 && numVal <= 100) {
                        setThreshold(numVal);
                      }
                    }
                  }}
                  className="w-28 h-10 text-base border border-gray-300 rounded px-3 py-2 mr-2 text-center"
                  placeholder={currentSettings?.threshold === null ? "Disabled" : "0-100"}
                />
                <span className="text-sm">%</span>
              </div>
            </div>
            <div
              className="relative py-4"
              style={{ zIndex: 20 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percentage = Math.round((x / rect.width) * 100);
                  const newValue = Math.max(0, Math.min(100, percentage));
                  setThreshold(newValue); // Directly set the threshold state
                }
              }}
            >
              <input
                type="range"
                id="confidenceThreshold"
                name="confidenceThreshold"
                min="0"
                max="100"
                value={threshold ?? 0} // Keep defaulting to 0 for range if local threshold is null (e.g. during typing)
                onChange={handleSliderChange}
                className={`w-full h-6 bg-blue-200 rounded-lg appearance-none cursor-pointer`}
                style={{
                  opacity: 1,
                  position: 'relative',
                  zIndex: 30,
                  accentColor: '#00B8D9',
                  cursor: 'pointer !important' // Always allow interaction
                }}
                disabled={isSubmitting} // Only disable if submitting
              />
              <div className="text-xs text-center mt-1 text-text-secondary">
                Drag the slider or click anywhere on the bar to adjust the threshold (0-100).
              </div>

              {/* Visual indicator */}
              <div className="w-full bg-gray-200 h-2 mt-2 rounded-full overflow-hidden">
                <div
                  className="bg-secondary h-full"
                  style={{ width: `${threshold ?? 0}%` }} // Use local threshold for visual
                ></div>
              </div>

              {/* Preset buttons */}
              <div className="flex justify-between mt-4">
                {[0, 20, 40, 60, 80, 100].map(val => (
                   <button
                    key={val}
                    type="button"
                    onClick={() => setThreshold(val)}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Analysis Results */}
          {threshold !== null && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium">Analysis Results (for {threshold}%)</h4>
                <button
                  onClick={() => debouncedFetchAnalysis(threshold)} // Refresh analysis for current threshold
                  disabled={isLoadingAnalysis || isSubmitting}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded flex items-center disabled:opacity-50"
                >
                  <span className={`mr-1 ${isLoadingAnalysis ? 'animate-spin' : ''}`}>⟳</span>
                  Refresh
                </button>
              </div>

              {isLoadingAnalysis && !analysisData && (
                <div className="text-center text-text-secondary py-4">Loading analysis data...</div>
              )}

              {analysisData && !error && (
                <div className={`space-y-3 text-sm ${isLoadingAnalysis ? 'opacity-50' : ''}`}>
                  <div className="p-4 rounded-md bg-gray-50"> {/* Increased padding from p-3 to p-4 */}
                    <p>
                      Human-AI Agreement for flags above <strong>{threshold}%</strong> confidence: <strong>
                        {analysisData.humanAiAgreementRate.toFixed(1)}%
                      </strong>
                      <span className="text-xs text-text-secondary">
                        &nbsp;(based on {analysisData.totalFlagsConsideredForAgreement.toLocaleString()} reviewed flags)
                      </span>
                    </p>
                  </div>
                  <div className="p-4 rounded-md bg-gray-50"> {/* Increased padding from p-3 to p-4 */}
                    <p>
                      <strong>{analysisData.flagsAboveThresholdPercentage.toFixed(1)}%</strong> of all flags
                      ({analysisData.totalFlagsAboveThreshold.toLocaleString()}
                      {analysisData.totalProjectFlags ? ` of ${analysisData.totalProjectFlags.toLocaleString()}` : ''} flags)
                      are above this confidence threshold.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Toggles */}
          <div className="mb-6 space-y-3">
            <h4 className="text-sm font-medium">Automated Actions (when threshold is enabled)</h4>
            <div className="flex items-center">
              <input
                id="autoApproveCompliant"
                type="checkbox"
                checked={autoApproveCompliant}
                onChange={(e) => setAutoApproveCompliant(e.target.checked)}
                className="text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50"
                disabled={isSubmitting || threshold === null} // Disable toggles if local threshold is null
              />
              <label htmlFor="autoApproveCompliant" className="ml-2 block text-sm text-text-primary">
                Automatically close compliant flags above threshold
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="autoRemediateViolation"
                type="checkbox"
                checked={autoRemediateViolation}
                onChange={(e) => setAutoRemediateViolation(e.target.checked)}
                className="text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50"
                disabled={isSubmitting || threshold === null} // Disable toggles if local threshold is null
              />
              <label htmlFor="autoRemediateViolation" className="ml-2 block text-sm text-text-primary">
                Automatically send violation flags above threshold to remediation
              </label>
            </div>
          </div>

          {/* Retroactive Application Checkbox */}
           <div className="mb-6 flex items-center">
              <input
                id="applyRetroactively"
                type="checkbox"
                checked={applyRetroactively}
                onChange={(e) => setApplyRetroactively(e.target.checked)}
                className="text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50"
                disabled={isSubmitting || threshold === null || (!autoApproveCompliant && !autoRemediateViolation)}
              />
              <label htmlFor="applyRetroactively" className="ml-2 block text-sm text-text-primary">
                Apply these settings to all existing pending flags? (This will trigger a background job)
              </label>
            </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={handleSetThresholdClick}
              className="btn-primary"
              disabled={isSubmitting || !canSetThreshold || !hasChanges} // Disable if no changes or threshold is null
            >
              {isSubmitting && modalAction === 'set' ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={handleClearSettingsClick}
              className="btn-secondary" // Use secondary style for clear
              disabled={isSubmitting || currentSettings?.threshold === null} // Disable if already disabled on backend
            >
              {isSubmitting && modalAction === 'clear' ? 'Disabling...' : 'Clear/Disable Bypass'}
            </button>
             <button
              onClick={handleRevertClick}
              className="btn-danger-outline" // Use danger outline style for revert
              disabled={isSubmitting}
            >
              {isSubmitting && modalAction === 'revert' ? 'Reverting...' : 'Revert Last Auto-Processing'}
            </button>
          </div>

          {/* Feedback Messages */}
          {submitSuccessMessage && (
            <div className="mt-4 bg-success bg-opacity-10 p-3 rounded-md text-success-dark">
              {submitSuccessMessage}
            </div>
          )}
          {submitError && (
            <div className="mt-4 bg-error bg-opacity-10 p-3 rounded-md text-error">
              Error: {submitError}
            </div>
          )}

          {/* Confirmation Modals */}
          <Modal
            isOpen={modalAction === 'set'}
            onClose={closeModal}
            onConfirm={handleConfirmAction}
            title="Confirm Bypass Settings Change"
          >
            <p>Are you sure you want to set the AI confidence bypass threshold to <strong>{threshold}%</strong> with the following actions?</p>
            <ul className="list-disc list-inside my-2 text-sm">
              <li>Auto-close compliant flags: <strong>{autoApproveCompliant ? 'Yes' : 'No'}</strong></li>
              <li>Auto-remediate violation flags: <strong>{autoRemediateViolation ? 'Yes' : 'No'}</strong></li>
            </ul>
            {applyRetroactively && (
              <p className="font-semibold text-warning mt-2">This will also apply these settings to all existing pending flags.</p>
            )}
             <p className="text-xs text-text-secondary mt-3">This will affect future scan processing and potentially trigger background jobs.</p>
          </Modal>

          <Modal
            isOpen={modalAction === 'clear'}
            onClose={closeModal}
            onConfirm={handleConfirmAction}
            title="Confirm Disable AI Bypass"
          >
            <p>Are you sure you want to clear the threshold and disable AI bypass processing?</p>
            <p className="text-sm text-text-secondary mt-2">No flags will be automatically processed based on AI confidence after this change.</p>
          </Modal>

           <Modal
            isOpen={modalAction === 'revert'}
            onClose={closeModal}
            onConfirm={handleConfirmAction}
            title="Confirm Revert Last Auto-Processing"
          >
            <p>Are you sure you want to revert the flag status changes made by the <strong>most recent</strong> AI bypass settings update (including any retroactive application)?</p>
            <p className="text-sm text-text-secondary mt-2">Flags automatically closed or sent to remediation by the last settings change will be returned to 'Pending' status.</p>
          </Modal>
        </>
      )}
    </div>
  );
};

export default AIConfidenceBypassControl;
