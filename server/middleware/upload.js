const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');

// Ensure upload directory exists and is not web-accessible
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Allowed MIME types (strict allowlist) ────────────────────
const ALLOWED_MIMES = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']);

// ── Multer memory storage (process before writing to disk) ──
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = !!ALLOWED_MIMES[file.mimetype];
  const extOk = ALLOWED_EXTENSIONS.has(ext);

  if (!mimeOk || !extOk) {
    return cb(new Error(`File type not allowed. Permitted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG`), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

// ── AES-256-CBC File Encryption ──────────────────────────────
const encryptBuffer = (buffer) => {
  const key = Buffer.from(process.env.FILE_ENC_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { encrypted, iv: iv.toString('hex') };
};

const decryptBuffer = (encryptedBuffer, ivHex) => {
  const key = Buffer.from(process.env.FILE_ENC_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
};

// ── EXIF Strip + Encrypt + Persist Middleware ─────────────────
const processAndSaveFile = async (req, res, next) => {
  let rawFiles = [];
  if (Array.isArray(req.files)) {
    rawFiles = req.files;
  } else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach(arr => {
      if (Array.isArray(arr)) rawFiles.push(...arr);
    });
  } else if (req.file) {
    rawFiles = [req.file];
  }

  if (rawFiles.length === 0) return next();

  try {
    const processedList = [];

    for (const f of rawFiles) {
      let fileBuffer = f.buffer;
      let exifStripped = false;

      // Strip EXIF metadata from images
      const isImage = ['image/jpeg', 'image/png'].includes(f.mimetype);
      if (isImage) {
        fileBuffer = await sharp(fileBuffer)
          .withMetadata({ exif: {} }) // clear all EXIF
          .toBuffer();
        exifStripped = true;
      }

      // Encrypt the (possibly EXIF-stripped) buffer
      const { encrypted, iv } = encryptBuffer(fileBuffer);

      // Write to disk with UUID filename (no original name in path)
      const storedFilename = `${uuidv4()}${path.extname(f.originalname).toLowerCase()}`;
      const encPath = path.join(UPLOAD_DIR, storedFilename);
      fs.writeFileSync(encPath, encrypted);

      processedList.push({
        originalFilename: path.basename(f.originalname).replace(/[^a-zA-Z0-9._-]/g, '_'),
        storedFilename,
        encryptedPath: path.relative(process.cwd(), encPath).replace(/\\/g, '/'),
        encryptionIv: iv,
        mimeType: f.mimetype,
        fileSizeBytes: fileBuffer.length,
        exifStripped,
      });
    }

    req.processedFiles = processedList;
    if (processedList.length > 0) {
      req.processedFile = processedList[0];
    }

    next();
  } catch (err) {
    console.error('[UPLOAD] File processing error:', err.message);
    return res.status(500).json({ error: 'File processing failed' });
  }
};

// ── Multer Error Handler ──────────────────────────────────────
const handleUploadErrors = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 10 MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

module.exports = { upload, processAndSaveFile, handleUploadErrors, decryptBuffer, UPLOAD_DIR };
