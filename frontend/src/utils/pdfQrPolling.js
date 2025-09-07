/**
 * PDF/QR Generation with Polling for Test Environment
 * Implements 202 Accepted + polling pattern for better E2E testing
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const IS_TEST_MODE = process.env.REACT_APP_TEST_MODE === 'true' || window.location.search.includes('test=true');

/**
 * Poll task status until completion
 * @param {string} statusUrl - URL to poll for task status
 * @param {number} maxAttempts - Maximum polling attempts (default: 30)
 * @param {number} interval - Polling interval in ms (default: 1000)
 * @returns {Promise<Object>} Task result when completed
 */
export async function pollTaskStatus(statusUrl, maxAttempts = 30, interval = 1000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Polling failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Check task status
      if (result.status === 'DONE') {
        return {
          success: true,
          data: result,
          downloadUrl: result.downloadUrl,
          attempts: attempt + 1
        };
      } else if (result.status === 'ERROR') {
        return {
          success: false,
          error: result.error || 'Task failed',
          attempts: attempt + 1
        };
      } else if (result.status === 'PROCESSING') {
        // Continue polling
        await new Promise(resolve => setTimeout(resolve, interval));
        continue;
      }
      
      // Unknown status, continue polling
      await new Promise(resolve => setTimeout(resolve, interval));
      
    } catch (error) {
      console.error(`Polling attempt ${attempt + 1} failed:`, error);
      
      // If it's the last attempt, throw the error
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  throw new Error(`Polling timed out after ${maxAttempts} attempts`);
}

/**
 * Generate PDF with polling support
 * @param {string} endpoint - API endpoint for PDF generation
 * @param {Object} payload - Request payload
 * @param {Object} options - Options (testId, timeout, etc.)
 * @returns {Promise<Object>} PDF generation result
 */
export async function generatePDFWithPolling(endpoint, payload = {}, options = {}) {
  const { testId, timeout = 30000 } = options;
  
  try {
    // Add test mode header if in test environment
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
    
    if (IS_TEST_MODE) {
      headers['X-Test-Mode'] = 'true';
    }
    
    // Start PDF generation
    const response = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (response.status === 202) {
      // Polling mode - get task info
      const taskInfo = await response.json();
      
      if (testId) {
        // Update UI to show polling started
        const statusElement = document.querySelector(`[data-testid="${testId}-status"]`);
        if (statusElement) {
          statusElement.textContent = 'PROCESSING';
          statusElement.setAttribute('data-status', 'processing');
        }
      }
      
      // Poll for completion
      const result = await pollTaskStatus(taskInfo.statusUrl, 30, 1000);
      
      if (testId) {
        // Update UI with final status
        const statusElement = document.querySelector(`[data-testid="${testId}-status"]`);
        if (statusElement) {
          statusElement.textContent = result.success ? 'DONE' : 'ERROR';
          statusElement.setAttribute('data-status', result.success ? 'done' : 'error');
        }
      }
      
      return result;
      
    } else if (response.status === 200) {
      // Direct mode - PDF generated immediately
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      if (testId) {
        const statusElement = document.querySelector(`[data-testid="${testId}-status"]`);
        if (statusElement) {
          statusElement.textContent = 'DONE';
          statusElement.setAttribute('data-status', 'done');
        }
      }
      
      return {
        success: true,
        downloadUrl,
        blob,
        attempts: 1
      };
      
    } else {
      throw new Error(`PDF generation failed: ${response.status}`);
    }
    
  } catch (error) {
    if (testId) {
      const statusElement = document.querySelector(`[data-testid="${testId}-status"]`);
      if (statusElement) {
        statusElement.textContent = 'ERROR';
        statusElement.setAttribute('data-status', 'error');
      }
    }
    
    throw error;
  }
}

/**
 * Generate QR code with polling support
 * @param {string} endpoint - API endpoint for QR generation
 * @param {Object} payload - Request payload
 * @param {Object} options - Options (testId, timeout, etc.)
 * @returns {Promise<Object>} QR generation result
 */
export async function generateQRWithPolling(endpoint, payload = {}, options = {}) {
  const { testId, timeout = 30000 } = options;
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
    
    if (IS_TEST_MODE) {
      headers['X-Test-Mode'] = 'true';
    }
    
    // Start QR generation
    const response = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (response.status === 202) {
      // Polling mode
      const taskInfo = await response.json();
      
      if (testId) {
        const qrElement = document.querySelector(`[data-testid="${testId}"]`);
        if (qrElement) {
          qrElement.setAttribute('data-status', 'processing');
        }
      }
      
      const result = await pollTaskStatus(taskInfo.statusUrl, 30, 1000);
      
      if (testId && result.success) {
        const qrElement = document.querySelector(`[data-testid="${testId}"]`);
        if (qrElement && result.data.qrCodeData) {
          qrElement.src = `data:image/png;base64,${result.data.qrCodeData}`;
          qrElement.setAttribute('data-status', 'done');
        }
      }
      
      return result;
      
    } else if (response.status === 200) {
      // Direct mode
      const qrData = await response.json();
      
      if (testId) {
        const qrElement = document.querySelector(`[data-testid="${testId}"]`);
        if (qrElement && qrData.qrCodeData) {
          qrElement.src = `data:image/png;base64,${qrData.qrCodeData}`;
          qrElement.setAttribute('data-status', 'done');
        }
      }
      
      return {
        success: true,
        data: qrData,
        attempts: 1
      };
      
    } else {
      throw new Error(`QR generation failed: ${response.status}`);
    }
    
  } catch (error) {
    if (testId) {
      const qrElement = document.querySelector(`[data-testid="${testId}"]`);
      if (qrElement) {
        qrElement.setAttribute('data-status', 'error');
      }
    }
    
    throw error;
  }
}

/**
 * Utility function to download file from URL
 * @param {string} url - Download URL
 * @param {string} filename - Suggested filename
 * @returns {Promise<void>}
 */
export async function downloadFile(url, filename = 'download') {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.setAttribute('data-testid', 'download-link');
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Wrapper for common PDF operations with E2E testing support
 */
export const PDFOperations = {
  /**
   * Generate student transcript PDF
   */
  async generateTranscript(studentId, options = {}) {
    return generatePDFWithPolling('/students/transcript', { studentId }, {
      testId: 'transcript-pdf',
      ...options
    });
  },
  
  /**
   * Generate grade sheet (acta) PDF
   */
  async generateGradeSheet(sectionId, options = {}) {
    return generatePDFWithPolling('/grades/acta', { sectionId }, {
      testId: 'acta-pdf',
      ...options
    });
  },
  
  /**
   * Generate schedule PDF
   */
  async generateSchedule(studentId, academicPeriod, options = {}) {
    return generatePDFWithPolling('/schedules/export', { studentId, academicPeriod }, {
      testId: 'schedule-pdf',
      ...options
    });
  },
  
  /**
   * Generate receipt PDF
   */
  async generateReceipt(receiptId, options = {}) {
    return generatePDFWithPolling('/receipts/pdf', { receiptId }, {
      testId: 'receipt-pdf',
      ...options
    });
  }
};

/**
 * Wrapper for common QR operations with E2E testing support
 */
export const QROperations = {
  /**
   * Generate QR for acta verification
   */
  async generateActaQR(actaId, options = {}) {
    return generateQRWithPolling('/actas/qr', { actaId }, {
      testId: 'acta-qr-code',
      ...options
    });
  },
  
  /**
   * Generate QR for receipt verification
   */
  async generateReceiptQR(receiptId, options = {}) {
    return generateQRWithPolling('/receipts/qr', { receiptId }, {
      testId: 'receipt-qr-code',
      ...options
    });
  },
  
  /**
   * Generate QR for certificate verification
   */
  async generateCertificateQR(certificateId, options = {}) {
    return generateQRWithPolling('/certificates/qr', { certificateId }, {
      testId: 'certificate-qr-code',
      ...options
    });
  }
};