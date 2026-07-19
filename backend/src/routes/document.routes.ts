import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { uploadSingle } from '../middleware/upload';
import {
  createDocumentMetadata,
  getDocumentById,
  listDocuments,
  updateDocumentMetadata,
  renewDocument,
  signDocument,
  archiveDocument,
  deleteDocument,
} from '../operations/document.controller';
import {
  uploadDocument,
  downloadDocument,
  generateSignedUrl,
} from '../operations/documentFile.controller';

const router = Router();

// All document routes require authentication
router.use(authenticate);

// Document file upload/download routes
router.post('/upload', uploadSingle, uploadDocument);
router.get('/:id/download', downloadDocument);
router.get('/:id/signed-url', generateSignedUrl);

// Document metadata routes
router.get('/', listDocuments);
router.get('/:id', getDocumentById);
router.post('/', createDocumentMetadata);
router.put('/:id', updateDocumentMetadata);
router.patch('/:id', updateDocumentMetadata);
router.post('/:id/renew', renewDocument);
router.post('/:id/sign', signDocument);
router.post('/:id/archive', archiveDocument);
router.delete('/:id', deleteDocument);

export default router;
