import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createInvoice,
  getInvoiceById,
  listInvoices,
  updateInvoice,
  voidInvoice,
  archiveInvoice,
  deleteInvoice,
  createInvoiceItem,
  updateInvoiceItem,
  deleteInvoiceItem,
  createPayment,
  getPaymentById,
  listPayments,
  updatePayment,
  createInsuranceRecord,
  getInsuranceRecordById,
  listInsuranceRecords,
  updateInsuranceRecord,
} from '../operations/billing.controller';

const router = Router();

// All billing routes require authentication
router.use(authenticate);

// Invoice routes
router.get('/invoices', listInvoices);
router.get('/invoices/:id', getInvoiceById);
router.post('/invoices', createInvoice);
router.put('/invoices/:id', updateInvoice);
router.patch('/invoices/:id', updateInvoice);
router.post('/invoices/:id/void', voidInvoice);
router.post('/invoices/:id/archive', archiveInvoice);
router.delete('/invoices/:id', deleteInvoice);

// Invoice item routes
router.post('/invoices/:id/items', createInvoiceItem);
router.patch('/invoices/:id/items/:itemId', updateInvoiceItem);
router.delete('/invoices/:id/items/:itemId', deleteInvoiceItem);

// Payment routes
router.get('/payments', listPayments);
router.get('/payments/:id', getPaymentById);
router.post('/payments', createPayment);
router.patch('/payments/:id', updatePayment);

// Insurance routes
router.get('/insurance', listInsuranceRecords);
router.get('/insurance/:id', getInsuranceRecordById);
router.post('/insurance', createInsuranceRecord);
router.patch('/insurance/:id', updateInsuranceRecord);

export default router;
