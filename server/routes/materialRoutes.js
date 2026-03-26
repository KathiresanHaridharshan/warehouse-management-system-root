const express = require('express');
const multer = require('multer');
const path = require('path');
const materialService = require('../services/materialService');

const router = express.Router();

// Image upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `material-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// GET /api/materials — list all (supports ?search=)
router.get('/', (req, res) => {
  try {
    const search = req.query.search || '';
    const materials = materialService.getAllMaterials(search);
    res.json({ success: true, data: materials });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
  }
});

// GET /api/materials/transactions/history
router.get('/transactions/history', (req, res) => {
  try {
    const history = materialService.getTransactionHistory();
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
  }
});

// GET /api/materials/:id
router.get('/:id', (req, res) => {
  try {
    const material = materialService.getMaterialById(parseInt(req.params.id));
    res.json({ success: true, data: material });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
  }
});

// POST /api/materials — create
router.post('/', (req, res) => {
  try {
    const material = materialService.createMaterial(req.body);
    res.status(201).json({ success: true, data: material });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
  }
});

// PUT /api/materials/:id — update
router.put('/:id', (req, res) => {
  try {
    const material = materialService.updateMaterial(parseInt(req.params.id), req.body);
    res.json({ success: true, data: material });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
  }
});

// PATCH /api/materials/:id/quantity — adjust quantity
router.patch('/:id/quantity', (req, res) => {
  try {
    const delta = parseInt(req.body.delta);
    if (isNaN(delta)) {
      return res.status(400).json({ success: false, message: 'Delta must be a number' });
    }
    const material = materialService.adjustQuantity(parseInt(req.params.id), delta);
    res.json({ success: true, data: material });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
  }
});

// DELETE /api/materials/:id
router.delete('/:id', (req, res) => {
  try {
    const material = materialService.deleteMaterial(parseInt(req.params.id));
    res.json({ success: true, data: material });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
  }
});

// POST /api/materials/:id/image — upload image
router.post('/:id/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    const imageURL = `/uploads/${req.file.filename}`;
    const material = materialService.uploadImage(parseInt(req.params.id), imageURL);
    res.json({ success: true, data: material });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
  }
});

function deleteMaterial(id) {
  const material = this.getMaterialById(id);
  
  // Log transaction before deletion
  materialRepository.logTransaction({
    materialId: id,
    itemName: material.itemName,
    type: 'DELETE',
    quantityChange: -material.quantity,
    newQuantity: 0
  });

  return materialRepository.delete(id);
}

function getTransactionHistory() {
  return materialRepository.getAllTransactions();
}

module.exports = router;
