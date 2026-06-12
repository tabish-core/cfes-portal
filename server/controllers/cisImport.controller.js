/**
 * cisImport.controller.js — CIS DOCX Import (proof-of-concept).
 *
 * POST /api/cis-import/parse
 *   - Accepts a .docx file via multipart/form-data (field name: "file")
 *   - Returns extracted JSON (tables, sections, raw text)
 *   - Does NOT save to MongoDB or touch existing CIS forms
 */

const { parseDocxBuffer } = require('../services/docxImportService');
const { mapExtractedToFormState } = require('../services/cisImportMapper');

/**
 * @route   POST /api/cis-import/parse
 * @desc    Parse an uploaded .docx CIS file and return structured data
 * @access  Public (test endpoint — no auth for PoC)
 */
const parseCISDocument = async (req, res) => {
  try {
    // 1. Validate file presence
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a .docx file.',
      });
    }

    // 2. Validate file type
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type: ${req.file.mimetype}. Only .docx files are accepted.`,
      });
    }

    // 3. Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File too large (${(req.file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`,
      });
    }

    // 4. Parse the document
    const result = await parseDocxBuffer(req.file.buffer);

    // 5. Return structured result
    return res.status(200).json({
      success: true,
      message: 'Document parsed successfully.',
      fileName: req.file.originalname,
      fileSize: req.file.size,
      data: result,
    });
  } catch (error) {
    console.error('[CIS Import] Parse error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to parse document.',
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/cis-import/parse-for-form
 * @desc    Parse an uploaded .docx CIS file and return mapped form state
 * @access  Private (requires auth token)
 */
const parseCISForForm = async (req, res) => {
  try {
    // 1. Validate file presence
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a .docx file.',
      });
    }

    // 2. Validate file type
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type: ${req.file.mimetype}. Only .docx files are accepted.`,
      });
    }

    // 3. Parse the document
    const extracted = await parseDocxBuffer(req.file.buffer);

    // 4. Map to form state
    const { formState, importSummary } = mapExtractedToFormState(extracted);

    // 5. Return mapped result
    return res.status(200).json({
      success: true,
      message: 'Document parsed and mapped successfully.',
      fileName: req.file.originalname,
      formState,
      importSummary,
    });
  } catch (error) {
    console.error('[CIS Import] Parse-for-form error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to parse and map document.',
      error: error.message,
    });
  }
};

module.exports = { parseCISDocument, parseCISForForm };
