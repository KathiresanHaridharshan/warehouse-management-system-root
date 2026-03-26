const { getDatabase } = require('../db/database');

class MaterialRepository {
  async getAll(search = '') {
    const db = await getDatabase();
    if (search) {
      const result = await db.query(`
        SELECT * FROM materials
        WHERE itemName ILIKE $1 OR itemCode ILIKE $2
        ORDER BY palletSlot ASC
      `, [`%${search}%`, `%${search}%`]);
      return result.rows;
    }
    const result = await db.query('SELECT * FROM materials ORDER BY palletSlot ASC');
    return result.rows;
  }

  async getById(id) {
    const db = await getDatabase();
    const result = await db.query('SELECT * FROM materials WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getByItemCode(itemCode) {
    const db = await getDatabase();
    const result = await db.query('SELECT * FROM materials WHERE itemCode = $1', [itemCode]);
    return result.rows[0];
  }

  async getNextAvailableSlot() {
    const db = await getDatabase();
    const result = await db.query('SELECT palletSlot FROM materials ORDER BY palletSlot ASC');
    const usedSlots = result.rows.map(r => r.palletSlot);
    for (let i = 1; i <= 100; i++) {
        if (!usedSlots.includes(i)) return i;
    }
    return null;
  }

  async create(material) {
    const db = await getDatabase();
    const result = await db.query(`
      INSERT INTO materials (itemCode, itemName, supplier, location, colorHex, imageURL, quantity, description, palletSlot)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [material.itemCode, material.itemName, material.supplier, material.location, material.colorHex, material.imageURL, material.quantity, material.description, material.palletSlot]);
    return result.rows[0];
  }

  async update(id, fields) {
    const db = await getDatabase();
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = ['itemCode', 'itemName', 'supplier', 'location', 'colorHex', 'imageURL', 'quantity', 'description'];
    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(fields[field]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return this.getById(id);

    setClauses.push(`updatedAt = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE materials SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await db.query(query, values);
    return result.rows[0];
  }

  async updateQuantity(id, delta) {
    const db = await getDatabase();
    const material = await this.getById(id);
    if (!material) return null;

    const newQty = parseInt(material.quantity) + delta;
    if (newQty < 0) return { error: 'Quantity cannot be negative' };

    await db.query("UPDATE materials SET quantity = $1, updatedAt = CURRENT_TIMESTAMP WHERE id = $2", [newQty, id]);
    
    // Log transaction
    await this.logTransaction({
      materialId: id,
      itemName: material.itemName,
      type: delta > 0 ? 'INCREASE' : 'DECREASE',
      quantityChange: delta,
      newQuantity: newQty
    });

    return this.getById(id);
  }

  async logTransaction(tx) {
    const db = await getDatabase();
    await db.query(`
      INSERT INTO transactions (materialId, itemName, type, quantityChange, newQuantity, timestamp)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [tx.materialId, tx.itemName, tx.type, tx.quantityChange, tx.newQuantity]);
  }

  async getAllTransactions() {
    const db = await getDatabase();
    const result = await db.query('SELECT * FROM transactions ORDER BY timestamp DESC');
    return result.rows;
  }

  async updateImage(id, imageURL) {
    const db = await getDatabase();
    const result = await db.query("UPDATE materials SET imageURL = $1, updatedAt = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *", [imageURL, id]);
    return result.rows[0];
  }

  async delete(id) {
    const db = await getDatabase();
    const material = await this.getById(id);
    if (!material) return null;
    await db.query('DELETE FROM materials WHERE id = $1', [id]);
    return material;
  }
}

module.exports = new MaterialRepository();
