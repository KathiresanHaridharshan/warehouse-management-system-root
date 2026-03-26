const { getDatabase } = require('../db/database');

class MaterialRepository {
  getAll(search = '') {
    const db = getDatabase();
    if (search) {
      return db.prepare(`
        SELECT * FROM materials
        WHERE itemName LIKE ? OR itemCode LIKE ?
        ORDER BY palletSlot ASC
      `).all(`%${search}%`, `%${search}%`);
    }
    return db.prepare('SELECT * FROM materials ORDER BY palletSlot ASC').all();
  }

  getById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM materials WHERE id = ?').get(id);
  }

  getByItemCode(itemCode) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM materials WHERE itemCode = ?').get(itemCode);
  }

  getNextAvailableSlot() {
    const db = getDatabase();
    const usedSlots = db.prepare('SELECT palletSlot FROM materials ORDER BY palletSlot ASC').all().map(r => r.palletSlot);
    for (let i = 1; i <= 100; i++) {
      if (!usedSlots.includes(i)) return i;
    }
    return null;
  }

  create(material) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO materials (itemCode, itemName, supplier, location, colorHex, imageURL, quantity, description, palletSlot)
      VALUES (@itemCode, @itemName, @supplier, @location, @colorHex, @imageURL, @quantity, @description, @palletSlot)
    `);
    const result = stmt.run(material);
    return this.getById(result.lastInsertRowid);
  }

  update(id, fields) {
    const db = getDatabase();
    const setClauses = [];
    const values = {};

    const allowedFields = ['itemCode', 'itemName', 'supplier', 'location', 'colorHex', 'imageURL', 'quantity', 'description'];
    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        setClauses.push(`${field} = @${field}`);
        values[field] = fields[field];
      }
    }

    if (setClauses.length === 0) return this.getById(id);

    setClauses.push("updatedAt = datetime('now')");
    values.id = id;

    db.prepare(`UPDATE materials SET ${setClauses.join(', ')} WHERE id = @id`).run(values);
    return this.getById(id);
  }

  updateQuantity(id, delta) {
    const db = getDatabase();
    const material = this.getById(id);
    if (!material) return null;

    const newQty = material.quantity + delta;
    if (newQty < 0) return { error: 'Quantity cannot be negative' };

    db.prepare("UPDATE materials SET quantity = ?, updatedAt = datetime('now') WHERE id = ?").run(newQty, id);
    
    // Log transaction
    this.logTransaction({
      materialId: id,
      itemName: material.itemName,
      type: delta > 0 ? 'INCREASE' : 'DECREASE',
      quantityChange: delta,
      newQuantity: newQty
    });

    return this.getById(id);
  }

  logTransaction(tx) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO transactions (materialId, itemName, type, quantityChange, newQuantity, timestamp)
      VALUES (@materialId, @itemName, @type, @quantityChange, @newQuantity, datetime('now'))
    `);
    stmt.run(tx);
  }

  getAllTransactions() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM transactions ORDER BY timestamp DESC').all();
  }

  updateImage(id, imageURL) {
    const db = getDatabase();
    db.prepare("UPDATE materials SET imageURL = ?, updatedAt = datetime('now') WHERE id = ?").run(imageURL, id);
    return this.getById(id);
  }

  delete(id) {
    const db = getDatabase();
    const material = this.getById(id);
    if (!material) return null;
    db.prepare('DELETE FROM materials WHERE id = ?').run(id);
    return material;
  }
}

module.exports = new MaterialRepository();
