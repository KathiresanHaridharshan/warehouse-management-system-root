import PalletCard from './PalletCard';

const TOTAL_SLOTS = 24;

export default function PalletGrid({ materials, onCardClick }) {
  const slots = [];
  const materialBySlot = {};

  materials.forEach((m) => {
    if (m.palletSlot) {
      materialBySlot[m.palletSlot] = m;
    }
  });

  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    slots.push(
      <PalletCard
        key={i}
        slotNumber={i}
        material={materialBySlot[i] || null}
        onClick={onCardClick}
      />
    );
  }

  return (
    <div className="pallet-grid-container">
      <div className="pallet-grid">{slots}</div>
    </div>
  );
}
