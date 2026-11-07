import { createUploadSignature, isCloudinaryConfigured } from '../services/cloudinary.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/respond.js';

// POST /api/uploads/signature { kind } — signed params for one direct browser → Cloudinary upload
export function signature(req, res) {
  if (!isCloudinaryConfigured()) {
    throw new AppError(503, 'Image uploads are not set up yet (Cloudinary keys missing on the server)');
  }
  ok(res, createUploadSignature(req.body.kind));
}
