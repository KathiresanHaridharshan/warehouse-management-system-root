const { getDatabase, closeDatabase } = require('./database');

const initialMaterials = [
  { itemCode: '014034', itemName: 'MASTERBATCH GREY', colorHex: '#aeaaaa', supplier: 'Default Supplier', location: 'Rack A1', quantity: 50, description: 'Grey masterbatch for plastic coloring' },
  { itemCode: '0105', itemName: 'POLYAMIDE 6 NATURE', colorHex: '#ffff00', supplier: 'Default Supplier', location: 'Rack A2', quantity: 100, description: 'Natural polyamide 6 base resin' },
  { itemCode: '290-1255', itemName: 'PC White Vltx Aria', colorHex: '#db51d7', supplier: 'Voltex', location: 'Rack A3', quantity: 75, description: 'Polycarbonate white for Voltex Aria product line' },
  { itemCode: '290-1258', itemName: 'PC Light Grey Vltx Aria', colorHex: '#ed7d31', supplier: 'Voltex', location: 'Rack A4', quantity: 60, description: 'Polycarbonate light grey for Voltex Aria product line' },
  { itemCode: '290-1017', itemName: 'AKULON BLACK RS223G6', colorHex: '#7030a0', supplier: 'DSM', location: 'Rack B1', quantity: 45, description: 'Black Akulon nylon compound for structural parts' },
  { itemCode: '290-1254', itemName: 'Voltex Red Masterbatch', colorHex: '#ff0000', supplier: 'Voltex', location: 'Rack B2', quantity: 30, description: 'Red masterbatch for Voltex product coloring' },
  { itemCode: '290-1064', itemName: 'Laser Markable Nylon MB', colorHex: '#00b0f0', supplier: 'Default Supplier', location: 'Rack B3', quantity: 25, description: 'Nylon masterbatch for laser marking applications' },
  { itemCode: '014035', itemName: 'MASTERBATCH BLUE', colorHex: '#0070c0', supplier: 'Default Supplier', location: 'Rack B4', quantity: 80, description: 'Blue masterbatch for plastic coloring' },
  { itemCode: '290-1256', itemName: 'PC Black Vltx Aria', colorHex: '#000000', supplier: 'Voltex', location: 'Rack C1', quantity: 55, description: 'Polycarbonate black for Voltex Aria product line' },
  { itemCode: '290-1066', itemName: 'Green Nylon Masterbatch', colorHex: '#00b050', supplier: 'Default Supplier', location: 'Rack C2', quantity: 40, description: 'Green nylon masterbatch for coloring applications' },
  { itemCode: '290-1018', itemName: 'POLYAMIDE 6', colorHex: '#c00000', supplier: 'Default Supplier', location: 'Rack C3', quantity: 90, description: 'Standard polyamide 6 engineering plastic' },
  { itemCode: '014005', itemName: 'MASTERBATCH WHITE', colorHex: '#e2efda', supplier: 'Default Supplier', location: 'Rack C4', quantity: 70, description: 'White masterbatch for plastic coloring' },
  { itemCode: '290-1209', itemName: 'Polycarbonate White S3000UR', colorHex: '#fce4d6', supplier: 'Default Supplier', location: 'Rack D1', quantity: 35, description: 'UV-resistant white polycarbonate compound' },
  { itemCode: '290-1274', itemName: 'Laser Inbuilt MB Slate Grey', colorHex: '#918f59', supplier: 'Default Supplier', location: 'Rack D2', quantity: 20, description: 'Slate grey masterbatch with inbuilt laser marking capability' },
  { itemCode: '290-1001', itemName: 'Poly Lexan Transclear', colorHex: '#ffc000', supplier: 'SABIC', location: 'Rack D3', quantity: 65, description: 'Transparent polycarbonate Lexan for clear parts' },
  { itemCode: '290-1003', itemName: 'Polycarbonate White', colorHex: '#ffffff', supplier: 'Default Supplier', location: 'Rack D4', quantity: 85, description: 'Standard white polycarbonate compound' },
];

function seed() {
  const db = getDatabase();

  const existingCount = db.prepare('SELECT COUNT(*) as count FROM materials').get().count;
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} materials. Skipping seed.`);
    closeDatabase();
    return;
  }

  const insert = db.prepare(`
    INSERT INTO materials (itemCode, itemName, supplier, location, colorHex, imageURL, quantity, description, palletSlot)
    VALUES (@itemCode, @itemName, @supplier, @location, @colorHex, '', @quantity, @description, @palletSlot)
  `);

  const insertMany = db.transaction((materials) => {
    materials.forEach((material, index) => {
      insert.run({ ...material, palletSlot: index + 1 });
    });
  });

  insertMany(initialMaterials);
  console.log(`Seeded ${initialMaterials.length} materials successfully.`);
  closeDatabase();
}

seed();
