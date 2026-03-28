const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  purchaseStock,
  useStock,
  summary,
  stockBatches,
  movements
} = require('../controllers/inventoryController');

const router = express.Router();

router.get('/summary', authRequired, summary);
router.get('/movements', authRequired, movements);
router.get('/items', authRequired, listItems);
router.get('/items/:id', authRequired, getItem);
router.get('/items/:id/batches', authRequired, stockBatches);
router.post('/items', authRequired, createItem);
router.put('/items/:id', authRequired, updateItem);
router.delete('/items/:id', authRequired, deleteItem);
router.post('/purchase', authRequired, purchaseStock);
router.post('/use', authRequired, useStock);

module.exports = router;
