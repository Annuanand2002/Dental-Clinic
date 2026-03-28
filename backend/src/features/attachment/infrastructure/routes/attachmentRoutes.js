const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const {
  listAttachments,
  browseAttachmentsHandler,
  uploadAttachment,
  updateAttachment,
  getAttachment,
  deleteAttachment
} = require('../controllers/attachmentController');

const router = express.Router();

router.get('/browse', authRequired, browseAttachmentsHandler);
router.get('/', authRequired, listAttachments);
router.post('/', authRequired, uploadAttachment);
router.put('/:id', authRequired, updateAttachment);
router.get('/:id', authRequired, getAttachment);
router.delete('/:id', authRequired, deleteAttachment);

module.exports = router;
