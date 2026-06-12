/**
 * cisImport.routes.js — CIS DOCX Import test routes.
 *
 * POST /api/cis-import/parse
 *   Accepts multipart/form-data with field "file" (.docx)
 *
 * No authentication required (PoC endpoint).
 */

const express = require('express');
const multer = require('multer');
const { parseCISDocument, parseCISForForm } = require('../controllers/cisImport.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// Memory storage — file stays in buffer, never touches disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are accepted'), false);
    }
  },
});

router.post('/parse', upload.single('file'), parseCISDocument);
router.post('/parse-for-form', verifyToken, upload.single('file'), parseCISForForm);

module.exports = router;
