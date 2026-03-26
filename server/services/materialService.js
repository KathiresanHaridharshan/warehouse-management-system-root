const materialRepository = require('../data/materialRepository');

const LOW_STOCK_THRESHOLD = 10;

class MaterialService {
  getAllMaterials(search = '') {
    const materials = materialRepository.getAll(search);
    return materials.map(m => ({
      ...m,
      isLowStock: m.quantity <= LOW_STOCK_THRESHOLD
    }));
  }

  getMaterialById(id) {
    const material = materialRepository.getById(id);
    if (!material) {
      throw { status: 404, message: 'Material not found' };
    }
    return { ...material, isLowStock: material.quantity <= LOW_STOCK_THRESHOLD };
  }

  createMaterial(data) {
    // Validate required fields
    if (!data.itemCode || !data.itemCode.trim()) {
      throw { status: 400, message: 'Item code is required' };
    }
    if (!data.itemName || !data.itemName.trim()) {
      throw { status: 400, message: 'Item name is required' };
    }

    // Check for duplicate item code
    const existing = materialRepository.getByItemCode(data.itemCode.trim());
    if (existing) {
      throw { status: 409, message: `Item code "${data.itemCode}" already exists` };
    }

    // Auto-assign pallet slot
    const palletSlot = materialRepository.getNextAvailableSlot();
    if (!palletSlot) {
      throw { status: 400, message: 'No available pallet slots' };
    }

    // Validate quantity
    const quantity = parseInt(data.quantity) || 0;
    if (quantity < 0) {
      throw { status: 400, message: 'Quantity cannot be negative' };
    }

    // Validate color hex
    const colorHex = data.colorHex || '#cccccc';
    if (!/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
      throw { status: 400, message: 'Invalid color hex format. Use #RRGGBB' };
    }

    const material = materialRepository.create({
      itemCode: data.itemCode.trim(),
      itemName: data.itemName.trim(),
      supplier: (data.supplier || '').trim(),
      location: (data.location || '').trim(),
      colorHex,
      imageURL: data.imageURL || '',
      quantity,
      description: (data.description || '').trim(),
      palletSlot
    });

    // Log transaction
    materialRepository.logTransaction({
      materialId: material.id,
      itemName: material.itemName,
      type: 'ADD',
      quantityChange: quantity,
      newQuantity: quantity
    });

    return { ...material, isLowStock: material.quantity <= LOW_STOCK_THRESHOLD };
  }

  updateMaterial(id, data) {
    // Ensure material exists
    const oldMaterial = this.getMaterialById(id);

    // Validate item code uniqueness if changing
    if (data.itemCode) {
      const existing = materialRepository.getByItemCode(data.itemCode.trim());
      if (existing && existing.id !== id) {
        throw { status: 409, message: `Item code "${data.itemCode}" already exists` };
      }
    }

    // Validate quantity
    if (data.quantity !== undefined) {
      const quantity = parseInt(data.quantity);
      if (isNaN(quantity) || quantity < 0) {
        throw { status: 400, message: 'Quantity must be a non-negative number' };
      }
      data.quantity = quantity;
    }

    // Validate color hex
    if (data.colorHex && !/^#[0-9A-Fa-f]{6}$/.test(data.colorHex)) {
      throw { status: 400, message: 'Invalid color hex format. Use #RRGGBB' };
    }

    const material = materialRepository.update(id, data);

    // Log transaction if quantity changed
    if (data.quantity !== undefined && data.quantity !== oldMaterial.quantity) {
      const delta = data.quantity - oldMaterial.quantity;
      materialRepository.logTransaction({
        materialId: id,
        itemName: material.itemName,
        type: delta > 0 ? 'INCREASE' : 'DECREASE',
        quantityChange: delta,
        newQuantity: material.quantity
      });
    }

    return { ...material, isLowStock: material.quantity <= LOW_STOCK_THRESHOLD };
  }

  adjustQuantity(id, delta) {
    if (!Number.isInteger(delta)) {
      throw { status: 400, message: 'Delta must be an integer' };
    }

    // Ensure material exists
    this.getMaterialById(id);

    const result = materialRepository.updateQuantity(id, delta);
    if (result.error) {
      throw { status: 400, message: result.error };
    }
    return { ...result, isLowStock: result.quantity <= LOW_STOCK_THRESHOLD };
  }

  uploadImage(id, imageURL) {
    this.getMaterialById(id);
    const material = materialRepository.updateImage(id, imageURL);
    return { ...material, isLowStock: material.quantity <= LOW_STOCK_THRESHOLD };
  }

  async deleteMaterial(id) {
    const material = await this.getMaterialById(id);
    
    // Log transaction before deletion
    await materialRepository.logTransaction({
      materialId: id,
      itemName: material.itemName,
      type: 'DELETE',
      quantityChange: -parseInt(material.quantity),
      newQuantity: 0
    });

    return await materialRepository.delete(id);
  }

  async getTransactionHistory() {
    return await materialRepository.getAllTransactions();
  }
}

module.exports = new MaterialService();
