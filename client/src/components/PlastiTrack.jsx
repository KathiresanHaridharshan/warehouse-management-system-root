import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import '../plastitrack.css';


/* ── Constants ── */
const COLORS = ['#5b8af5','#7c5bf5','#38c9b5','#f5824d','#f55b9a','#f5d44d','#4df5a8','#f54d4d','#4dbef5','#c5f54d'];
const COMMON_PLASTICS = ['PET','HDPE','PVC','LDPE','PP','PS','ABS','PC','Nylon (Polyamide)','PMMA (Acrylic)','POM (Acetal)','TPE','TPU','PEEK','Recycled PET (rPET)','Bio-based PLA'];
const EMOJI_OPTIONS = ['📦','🍶','🧴','🪣','🧃','🥤','🧪','💊','🔋','🖥️','🚗','🎮'];

/* ── Utilities ── */
const uid = () => 'id_' + Math.random().toString(36).slice(2, 10);
const formatWeight = (g) => g >= 1000 ? (g / 1000).toFixed(3).replace(/\.?0+$/, '') + ' kg' : g + ' g';
const generateCode = (name) => {
  const w = name.trim().split(/\s+/);
  const p = w.length >= 2 ? w.slice(0,2).map(x=>x[0].toUpperCase()).join('') : (w[0]||'P').slice(0,2).toUpperCase();
  return `${p}-${Math.floor(Math.random()*900+100)}`;
};
const recalcPct = (mats) => {
  const total = mats.reduce((s,m) => s + (m.weight||0), 0);
  return mats.map(m => ({ ...m, pct: total > 0 ? Math.round((m.weight/total)*1000)/10 : 0 }));
};

/* ── Default seed data ── */
const mkMats = (arr) => recalcPct(arr.map(([name,weight]) => ({ id: uid(), name, weight, image: null })));
const DEFAULT_PRODUCTS = [
  { id:'p001', name:'Water Bottle 500ml', code:'WB-500', category:'Packaging', icon:'🍶', image:null,
    description:'A standard 500ml water bottle designed for single-use consumption. Made primarily from PET for clarity and recyclability, with a PP cap for secure closure and an LDPE inner liner for moisture resistance.',
    materials: mkMats([['PET',17],['PP',2],['LDPE',1]]) },
  { id:'p002', name:'Shampoo Bottle', code:'SB-250', category:'Personal Care', icon:'🧴', image:null,
    description:'A 250ml shampoo bottle crafted for personal care applications. HDPE provides chemical resistance, PP delivers pump mechanism action, and TPE offers ergonomic grip comfort.',
    materials: mkMats([['HDPE',17.5],['PP',5],['TPE',2.5]]) },
  { id:'p003', name:'Storage Container', code:'SC-5L', category:'Household', icon:'🪣', image:null,
    description:'A 5-litre household storage container engineered for durability. PP provides rigidity, LDPE forms the airtight seal gasket, and EVA cushions the base against impact.',
    materials: mkMats([['PP',240],['LDPE',100],['EVA',60]]) },
  { id:'p004', name:'Electronic Housing', code:'EH-001', category:'Electronics', icon:'🖥️', image:null,
    description:'Precision-moulded housing for consumer electronics requiring flame retardancy. ABS forms the structural shell, PC provides impact-resistant windows, and TPU creates flexible port covers.',
    materials: mkMats([['ABS',385],['PC',210],['TPU',105]]) },
  { id:'p005', name:'Juice Carton Liner', code:'JCL-01', category:'Food & Beverage', icon:'🧃', image:null,
    description:'A multi-layer flexible liner for juice cartons. LDPE forms heat-sealable layers, rPET provides tensile strength, and EVOH acts as an oxygen and flavour barrier.',
    materials: mkMats([['LDPE',9],['Recycled PET (rPET)',7],['EVOH',4]]) },
  { id:'p006', name:'Pharmaceutical Blister', code:'PB-001', category:'Healthcare', icon:'💊', image:null,
    description:'A pharmaceutical-grade blister pack protecting tablets from moisture. PVC forms thermoformable cavities, PVDC adds superior barrier properties, and PE forms the heat-seal layer.',
    materials: mkMats([['PVC',6.5],['PVDC',2.5],['PE',1]]) },
];

/* ── Modal wrapper ── */
function Modal({ children, onClose, small = false }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={small ? 'pt-modal-card pt-modal-small' : 'pt-modal-card'}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Donut chart ── */
function DonutChart({ materials }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c || !materials.length) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height, cx = W/2, cy = H/2;
    const r = Math.min(W,H)/2 - 12, inner = r * 0.58, gap = 0.04;
    ctx.clearRect(0,0,W,H);
    let start = -Math.PI/2;
    materials.forEach((m,i) => {
      const slice = (m.pct/100)*(2*Math.PI);
      const end = start + slice - gap;
      const color = COLORS[i % COLORS.length];
      ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,end); ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(cx,cy,inner,0,2*Math.PI); ctx.fillStyle='#fff'; ctx.fill();
      start += slice;
    });
  }, [materials]);
  const totalW = materials.reduce((s,m) => s+(m.weight||0), 0);
  return (
    <div className="pt-donut-wrapper">
      <canvas ref={ref} width={220} height={220} />
      <div className="pt-donut-center">
        <span className="pt-donut-label">Materials</span>
        <span className="pt-donut-count">{materials.length}</span>
        <span className="pt-donut-weight">{formatWeight(totalW)}</span>
      </div>
    </div>
  );
}

/* ── Image Upload Zone ── */
function UploadZone({ value, onChange, onError }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const handle = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { onError?.('Invalid type. Use PNG, JPG or WEBP.'); return; }
    if (file.size > 5*1024*1024) { onError?.('File too large. Max 5 MB.'); return; }
    const r = new FileReader(); r.onload = e => onChange(e.target.result); r.readAsDataURL(file);
  };
  return (
    <div
      className={`pt-upload-zone${drag?' dragging':''}${value?' has-image':''}`}
      onClick={() => !value && ref.current?.click()}
      onDragOver={e=>{e.preventDefault();setDrag(true);}}
      onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);handle(e.dataTransfer.files[0]);}}
      onKeyDown={e=>{if(!value&&(e.key==='Enter'||e.key===' '))ref.current?.click();}}
      tabIndex={0} role="button" title="Upload image"
    >
      <input ref={ref} type="file" accept="image/*" hidden onChange={e=>handle(e.target.files[0])} />
      {value ? (
        <div className="pt-upload-preview">
          <img src={value} alt="preview" />
          <button className="pt-upload-clear" onClick={e=>{e.stopPropagation();onChange(null);}} title="Remove">×</button>
        </div>
      ) : (
        <div className="upload-placeholder">
          <span className="upload-icon">📷</span>
          <span>Drop image here or <strong>click to browse</strong></span>
          <span style={{fontSize:'0.72rem',color:'var(--gray-400)'}}>PNG, JPG, WEBP · Max 5 MB</span>
        </div>
      )}
    </div>
  );
}

/* ── Product Card ── */
function ProductCard({ product: p, index, onOpen, onEdit, onDelete, userMode=false }) {
  const prev = p.materials.slice(0,3), extra = p.materials.length - 3;
  return (
    <div className="pt-card" style={{animationDelay:`${index*0.055}s`}} onClick={onOpen}>
      {p.image && <div className="pt-card-banner"><img src={p.image} alt={p.name}/></div>}
      <div className="pt-card-body">
        <div className="pt-card-top">
          <div className="pt-card-icon-row">
            <span className="pt-card-icon">{p.icon}</span>
            <div>
              <div className="pt-card-name">{p.name}</div>
              <div className="pt-card-code">{p.code}</div>
            </div>
          </div>
          {!userMode && (
            <div className="pt-card-actions" onClick={e=>e.stopPropagation()}>
              <button className="action-btn" onClick={onEdit} title="Edit">✏️</button>
              <button className="action-btn delete" onClick={onDelete} title="Delete">🗑️</button>
            </div>
          )}
        </div>
        {p.category && <span className="pt-category-badge">{p.category}</span>}
        <div className="pt-bars">
          {prev.map((m,i) => (
            <div key={m.id} className="pt-bar-row">
              <span className="pt-bar-label">{m.name}</span>
              <div className="pt-bar-track"><div className="pt-bar-fill" style={{width:`${m.pct}%`,background:COLORS[i%COLORS.length]}}/></div>
              <span className="pt-bar-pct">{m.pct}%</span>
            </div>
          ))}
          {extra > 0 && <span className="pt-bar-more">+{extra} more</span>}
        </div>
        <div className="pt-card-footer">
          <span className="pt-mat-count">{p.materials.length} material{p.materials.length!==1?'s':''}</span>
          <span className="pt-card-arrow">›</span>
        </div>
      </div>
    </div>
  );
}

/* ── Detail Modal ── */
function DetailModal({ product: p, onClose, onEdit, userMode, yieldInput, setYieldInput }) {
  const totalW = p.materials.reduce((s,m)=>s+(m.weight||0),0);
  const targetKg = parseFloat(yieldInput)||0;
  const handleKey = (k) => {
    if (k==='C') setYieldInput('');
    else if (k==='⌫') setYieldInput(v=>v.slice(0,-1));
    else if (k==='.') setYieldInput(v=>v.includes('.')?v:v+k);
    else setYieldInput(v=>v+k);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pt-detail-card" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="pt-detail-header">
          <div className="pt-detail-title-row">
            <span className="pt-detail-icon">{p.icon}</span>
            <div>
              <div className="dm-title-text">{p.name}</div>
              <div style={{display:'flex',gap:'8px',marginTop:'4px',flexWrap:'wrap'}}>
                {p.category && <span className="pt-category-badge">{p.category}</span>}
                <span className="pt-code-badge">{p.code}</span>
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexShrink:0}}>
            {!userMode && <button className="btn btn-secondary" style={{flex:'none',padding:'6px 14px',fontSize:'0.8rem'}} onClick={onEdit}>✏️ Edit</button>}
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        {/* Body */}
        <div className="pt-detail-body">
          {p.image && <div className="pt-detail-img"><img src={p.image} alt={p.name}/></div>}
          {p.description && <p className="pt-detail-desc">{p.description}</p>}

          {/* Composition */}
          <div className="pt-section">
            <div className="section-title">Material Composition</div>
            {p.materials.length > 0 ? (
              <div className="pt-comp-inner">
                <DonutChart materials={p.materials}/>
                <div className="pt-legend">
                  {p.materials.map((m,i)=>(
                    <div key={m.id} className="pt-legend-row">
                      <span className="pt-legend-dot" style={{background:COLORS[i%COLORS.length]}}/>
                      <span className="pt-legend-name">{m.name}</span>
                      <span className="pt-legend-weight">{formatWeight(m.weight)}</span>
                      <span className="pt-legend-pct">{m.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p style={{color:'var(--gray-400)',fontSize:'0.85rem'}}>No materials defined.</p>}
          </div>

          {/* Components list */}
          {p.materials.length > 0 && (
            <div className="pt-section">
              <div className="section-title">Components</div>
              <div className="pt-comp-list">
                {p.materials.map((m,i)=>(
                  <div key={m.id} className="pt-comp-row">
                    {m.image
                      ? <img src={m.image} alt={m.name} className="pt-comp-img"/>
                      : <span className="pt-comp-dot" style={{background:COLORS[i%COLORS.length]}}/>}
                    <span className="pt-comp-name">{m.name}</span>
                    <span className="pt-comp-pct" style={{background:COLORS[i%COLORS.length]+'22',color:COLORS[i%COLORS.length]}}>{m.pct}%</span>
                  </div>
                ))}
              </div>
              <div className="pt-pct-status">
                Total weight: {formatWeight(totalW)} — percentages calculated automatically.
              </div>
            </div>
          )}

          {/* Yield Calculator (user mode) */}
          {userMode && p.materials.length > 0 && (
            <div className="pt-section pt-yield-section">
              <div className="section-title">Manufacturing Yield Tool</div>
              <p className="pt-yield-desc">Calculate required materials for a production batch based on this product's plastic composition.</p>
              <div className="form-field">
                <label>Production Batch Size (Kilograms)</label>
                <div className="pt-unit-row">
                  <input className="pt-yield-input" type="text" readOnly value={yieldInput} placeholder="0.000"/>
                  <span className="pt-unit-badge">kg</span>
                </div>
              </div>
              <div className="pt-keypad">
                {['7','8','9','⌫','4','5','6','C','1','2','3','.','0'].map(k=>(
                  <button key={k} className={`pt-key${k==='C'?' pt-key-clear':''}${k==='⌫'?' pt-key-back':''}`} onClick={()=>handleKey(k)}>{k}</button>
                ))}
              </div>
              {targetKg > 0 && (
                <div className="pt-yield-results">
                  <div className="pt-yield-results-title">Required Materials Breakdown</div>
                  <table className="pt-yield-table">
                    <tbody>
                      {p.materials.map((m,i)=>{
                        const req = (m.pct/100)*targetKg;
                        return (
                          <tr key={m.id}>
                            <td><span className="pt-comp-dot" style={{background:COLORS[i%COLORS.length],display:'inline-block'}}/> {m.name}</td>
                            <td className="pt-yield-val">{req.toFixed(3)} <span className="pt-unit-sm">kg</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PLASTITRACK
══════════════════════════════════════════════════════════ */
export default function PlastiTrack({ onToast }) {
  const [mode, setMode] = useState(() => localStorage.getItem('plastitrack_mode') || 'admin');
  const [products, setProducts] = useState([]);
  const [library, setLibrary] = useState([]);
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [yieldInput, setYieldInput] = useState('');

  /* modal states */
  const [detailProd, setDetailProd] = useState(null);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  const [deleteProd, setDeleteProd] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showPickLib, setShowPickLib] = useState(false);
  const [showAddMat, setShowAddMat] = useState(false);

  /* form state */
  const [form, setForm] = useState({ name:'', code:'', category:'', description:'', icon:'📦', image:null });
  const [tempMats, setTempMats] = useState([]);
  const [matForm, setMatForm] = useState({ name:'', weight:'', image:null });

  /* library picker */
  const [libQ, setLibQ] = useState('');
  const [pickedLib, setPickedLib] = useState(null);
  const [pickWeight, setPickWeight] = useState('');
  const [libAdminQ, setLibAdminQ] = useState('');

  /* Firestore refs */
  const prodRef = doc(db, 'appData','products');
  const libRef  = doc(db, 'appData','library');

  const saveProd = async (data) => { await setDoc(prodRef, { data }); };
  const saveLib  = async (data) => { await setDoc(libRef,  { data }); };

  /* Merge material into library (deduplicated by lowercased name) */
  const mergeLib = useCallback((name, image, productId, lib) => {
    const arr = [...lib];
    const idx = arr.findIndex(e => e.name.toLowerCase() === name.toLowerCase());
    if (idx >= 0) {
      if (!arr[idx].image && image) arr[idx] = { ...arr[idx], image };
      if (productId && !arr[idx].usedIn.includes(productId))
        arr[idx] = { ...arr[idx], usedIn:[...arr[idx].usedIn, productId] };
    } else {
      arr.push({ id:uid(), name, image:image||null, usedIn: productId?[productId]:[] });
    }
    return arr;
  }, []);

  /* Firebase realtime sync */
  useEffect(() => {
    const unsubP = onSnapshot(prodRef, snap => {
      if (snap.exists()) {
        setProducts(snap.data().data || []);
      } else {
        saveProd(DEFAULT_PRODUCTS);
        setProducts(DEFAULT_PRODUCTS);
        let lib = [];
        DEFAULT_PRODUCTS.forEach(p => p.materials.forEach(m => { lib = mergeLib(m.name, m.image, p.id, lib); }));
        saveLib(lib);
      }
    });
    const unsubL = onSnapshot(libRef, snap => {
      if (snap.exists()) setLibrary(snap.data().data || []);
    });
    return () => { unsubP(); unsubL(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ESC + body scroll lock */
  useEffect(() => {
    const any = detailProd||showAddEdit||deleteProd||showLibrary||showPickLib||showAddMat;
    document.body.style.overflow = any ? 'hidden' : '';
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      if (showAddMat) { setShowAddMat(false); return; }
      if (showPickLib) { setShowPickLib(false); setPickedLib(null); return; }
      if (showLibrary) { setShowLibrary(false); return; }
      if (deleteProd) { setDeleteProd(null); return; }
      if (showAddEdit) { setShowAddEdit(false); return; }
      if (detailProd) { setDetailProd(null); return; }
    };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow=''; };
  }, [detailProd, showAddEdit, deleteProd, showLibrary, showPickLib, showAddMat]);

  /* Mode toggle */
  const toggleMode = () => {
    const m = mode==='admin' ? 'user' : 'admin';
    setMode(m); localStorage.setItem('plastitrack_mode', m);
    onToast(`Switched to ${m==='admin'?'Admin':'User'} Mode`, 'info');
  };

  /* Stats */
  const uniqueMats = new Set(products.flatMap(p=>p.materials.map(m=>m.name.toLowerCase()))).size;
  const avgTypes = products.length > 0 ? (products.reduce((s,p)=>s+p.materials.length,0)/products.length).toFixed(1) : '0.0';

  /* Filtered products */
  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });
  const userResults = userSearch.trim() ? products.filter(p => {
    const q = userSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  }) : [];

  /* Open add */
  const openAdd = () => {
    setEditingProd(null);
    setForm({ name:'', code:'', category:'', description:'', icon:'📦', image:null });
    setTempMats([]); setShowAddEdit(true);
  };

  /* Open edit */
  const openEdit = (p) => {
    setEditingProd(p);
    setForm({ name:p.name, code:p.code, category:p.category, description:p.description, icon:p.icon, image:p.image });
    setTempMats(p.materials.map(m=>({...m}))); setShowAddEdit(true);
  };

  /* Save product */
  const handleSave = async () => {
    if (!form.name.trim()) { onToast('Product name is required','error'); return; }
    if (!form.code.trim()) { onToast('Product code is required','error'); return; }
    const codeUsed = products.some(p => p.code.toLowerCase()===form.code.toLowerCase() && p.id!==editingProd?.id);
    if (codeUsed) { onToast('Product code already exists','error'); return; }
    const mats = recalcPct(tempMats.map(m=>({...m})));
    let newProds, pid;
    if (editingProd) {
      pid = editingProd.id;
      newProds = products.map(p => p.id===pid ? {...p,...form,materials:mats} : p);
      onToast(`"${form.name}" updated!`,'success');
    } else {
      pid = uid();
      newProds = [...products, { id:pid, ...form, materials:mats }];
      onToast(`"${form.name}" added!`,'success');
    }
    await saveProd(newProds);
    let lib = [...library];
    mats.forEach(m => { lib = mergeLib(m.name, m.image, pid, lib); });
    await saveLib(lib);
    setShowAddEdit(false);
  };

  /* Delete product */
  const handleDelete = async () => {
    const p = deleteProd;
    await saveProd(products.filter(x=>x.id!==p.id));
    await saveLib(library.map(e=>({...e,usedIn:e.usedIn.filter(id=>id!==p.id)})));
    onToast(`"${p.name}" deleted`,'success');
    setDeleteProd(null);
  };

  /* Delete from library */
  const delFromLib = async (id) => {
    await saveLib(library.filter(e=>e.id!==id));
    onToast('Removed from library','success');
  };

  /* Add material (new) */
  const handleAddMat = async () => {
    if (!matForm.name.trim()) { onToast('Material name required','error'); return; }
    if (!matForm.weight || parseFloat(matForm.weight)<=0) { onToast('Weight must be > 0','error'); return; }
    const m = { id:uid(), name:matForm.name.trim(), weight:parseFloat(matForm.weight), pct:0, image:matForm.image };
    setTempMats(prev => recalcPct([...prev, m]));
    const lib = mergeLib(m.name, m.image, null, library);
    await saveLib(lib);
    setMatForm({ name:'', weight:'', image:null }); setShowAddMat(false);
    onToast(`"${m.name}" added`,'info');
  };

  /* Pick from library */
  const handlePickLib = () => {
    if (!pickedLib) return;
    if (!pickWeight || parseFloat(pickWeight)<=0) { onToast('Enter a valid weight','error'); return; }
    const m = { id:uid(), name:pickedLib.name, weight:parseFloat(pickWeight), pct:0, image:pickedLib.image||null };
    setTempMats(prev => recalcPct([...prev, m]));
    setPickedLib(null); setPickWeight(''); setShowPickLib(false);
    onToast(`"${m.name}" added to product`,'info');
  };

  /* ── Render ── */
  return (
    <div className="plastitrack">

      {/* ── Top bar ── */}
      <div className="pt-topbar">
        <div className="pt-topbar-left">
          <span className="pt-page-icon">🧪</span>
          <div>
            <div className="pt-page-title">PlastiTrack</div>
            <div className="pt-page-sub">Product Plastic Composition Tracker</div>
          </div>
        </div>
        <div className="pt-topbar-right">
          {mode==='admin' && (
            <>
              <button className="btn btn-secondary" style={{flex:'none'}} onClick={()=>{setLibAdminQ('');setShowLibrary(true);}}>🧪 Library</button>
              <button className="btn btn-primary"   style={{flex:'none'}} onClick={openAdd}>+ Add Product</button>
            </>
          )}
          <div
            className={`pt-mode-toggle${mode==='user'?' user':''}`}
            role="button" tabIndex={0} title={`Switch to ${mode==='admin'?'User':'Admin'} Mode`}
            onClick={toggleMode}
            onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')toggleMode();}}
          >
            <span className="pt-mode-label">{mode==='admin'?'⚙️ Admin':'👤 User'}</span>
            <div className="pt-toggle-track"><div className="pt-toggle-thumb"/></div>
          </div>
        </div>
      </div>

      {/* ── ADMIN MODE ── */}
      {mode==='admin' && (
        <>
          <div className="pt-stats-strip">
            {[['📦', products.length, 'Products','accent'],
              ['🧪', uniqueMats, 'Unique Materials','info'],
              ['📊', avgTypes, 'Avg Types / Product','success']
            ].map(([icon, val, label, cls]) => (
              <div key={label} className={`pt-stat-pill ${cls}`}>
                <span className="pt-stat-icon">{icon}</span>
                <div><div className="pt-stat-val">{val}</div><div className="pt-stat-name">{label}</div></div>
              </div>
            ))}
          </div>

          <div className="pt-admin-search">
            <div className="search-input-wrapper" style={{width:'100%',maxWidth:'400px'}}>
              <span className="search-icon">🔍</span>
              <input className="search-input" placeholder="Search by name, category, code…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="pt-empty-state">
              <span style={{fontSize:'3rem'}}>📦</span>
              <h3>No Products Yet</h3>
              <p>{search ? 'No products match your search.' : 'Click "+ Add Product" to get started.'}</p>
            </div>
          ) : (
            <div className="pt-grid">
              {filtered.map((p,i)=>(
                <ProductCard key={p.id} product={p} index={i}
                  onOpen={()=>setDetailProd(p)} onEdit={()=>openEdit(p)} onDelete={()=>setDeleteProd(p)}/>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── USER MODE ── */}
      {mode==='user' && (
        <div className="pt-user-view">
          <div className="pt-user-hero">
            <div className="pt-user-hero-icon">🧪</div>
            <h2 className="pt-user-hero-title">Find a Product</h2>
            <p className="pt-user-hero-sub">Search by product name or product code</p>
            <div className="search-input-wrapper pt-user-search">
              <span className="search-icon">🔍</span>
              <input className="search-input" placeholder="e.g. Water Bottle or WB-500" value={userSearch} onChange={e=>setUserSearch(e.target.value)} autoFocus/>
            </div>
          </div>
          {userSearch.trim().length > 0 && (
            userResults.length === 0
              ? <div className="pt-user-empty"><span style={{fontSize:'2rem'}}>🔍</span><p>No products found for "<strong>{userSearch}</strong>"</p></div>
              : <div className="pt-grid pt-user-grid">{userResults.map((p,i)=><ProductCard key={p.id} product={p} index={i} onOpen={()=>{setYieldInput('');setDetailProd(p);}} userMode/>)}</div>
          )}
        </div>
      )}

      {/* ════════ MODALS ════════ */}

      {/* Detail */}
      {detailProd && (
        <DetailModal
          product={detailProd} onClose={()=>setDetailProd(null)}
          onEdit={()=>{setDetailProd(null);openEdit(detailProd);}}
          userMode={mode==='user'} yieldInput={yieldInput} setYieldInput={setYieldInput}
        />
      )}

      {/* Add / Edit Product */}
      {showAddEdit && (
        <Modal onClose={()=>setShowAddEdit(false)}>
          <div className="pt-modal-header">
            <h2 className="pt-modal-title">{editingProd ? 'Edit Product' : 'Add Product'}</h2>
            <button className="close-btn" onClick={()=>setShowAddEdit(false)}>×</button>
          </div>
          <div className="pt-modal-body">
            <div className="form-grid">
              <div className="form-field">
                <label>Product Name <span className="pt-req">*</span></label>
                <input type="text" placeholder="e.g. Water Bottle 500ml" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
              </div>
              <div className="form-field">
                <label>Product Code <span className="pt-req">*</span></label>
                <input type="text" placeholder="e.g. WB-500" value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/>
                <span style={{fontSize:'0.72rem',color:'var(--gray-400)'}}>Unique code used to identify this product</span>
              </div>
              <div className="form-field">
                <label>Category</label>
                <input type="text" placeholder="e.g. Packaging" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/>
              </div>
              <div className="form-field">
                <label>Icon</label>
                <div className="pt-emoji-row">
                  {EMOJI_OPTIONS.map(em=>(
                    <button key={em} type="button" className={`pt-emoji-btn${form.icon===em?' selected':''}`}
                      onClick={()=>setForm({...form,icon:em})}>{em}</button>
                  ))}
                </div>
              </div>
              <div className="form-field full-width">
                <label>Description</label>
                <textarea rows={3} placeholder="Describe this product…" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
              </div>
              <div className="form-field full-width">
                <label>Product Image</label>
                <UploadZone value={form.image} onChange={v=>setForm({...form,image:v})} onError={msg=>onToast(msg,'error')}/>
              </div>
            </div>

            {/* Materials */}
            <div className="pt-mat-section">
              <div className="pt-mat-header">
                <span className="section-title">Materials</span>
                <div style={{display:'flex',gap:'8px'}}>
                  <button className="btn btn-secondary" style={{flex:'none'}} onClick={()=>{
                    if(!library.length){onToast('Library is empty. Add a new material first.','info');return;}
                    setLibQ('');setPickedLib(null);setPickWeight('');setShowPickLib(true);
                  }}>📚 From Library</button>
                  <button className="btn btn-secondary" style={{flex:'none'}} onClick={()=>{setMatForm({name:'',weight:'',image:null});setShowAddMat(true);}}>+ New Material</button>
                </div>
              </div>
              {tempMats.length === 0
                ? <div className="pt-mat-empty">No materials added yet.</div>
                : (
                  <div className="pt-form-mat-list">
                    {tempMats.map((m,i)=>(
                      <div key={m.id} className="pt-form-mat-row">
                        <span className="pt-form-mat-dot" style={{background:COLORS[i%COLORS.length]}}/>
                        <span className="pt-form-mat-name">{m.name}</span>
                        <span className="badge">{m.weight}g</span>
                        <button className="pt-form-mat-x" onClick={()=>setTempMats(prev=>recalcPct(prev.filter(x=>x.id!==m.id)))} title="Remove">×</button>
                      </div>
                    ))}
                  </div>
                )
              }
              {tempMats.length > 0 && (
                <div className="pt-pct-status">
                  Total weight: {formatWeight(tempMats.reduce((s,m)=>s+(m.weight||0),0))} — percentages calculated automatically.
                </div>
              )}
            </div>
          </div>
          <div className="pt-modal-footer">
            <button className="btn btn-secondary" onClick={()=>setShowAddEdit(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editingProd ? 'Save Changes' : 'Create Product'}</button>
          </div>
        </Modal>
      )}

      {/* Add Material */}
      {showAddMat && (
        <Modal onClose={()=>setShowAddMat(false)} small>
          <div className="pt-modal-header">
            <h2 className="pt-modal-title">New Material</h2>
            <button className="close-btn" onClick={()=>setShowAddMat(false)}>×</button>
          </div>
          <div className="pt-modal-body">
            <div className="form-grid" style={{gridTemplateColumns:'1fr'}}>
              <div className="form-field">
                <label>Material Name <span className="pt-req">*</span></label>
                <input type="text" list="plastics-dl" placeholder="e.g. PET" value={matForm.name} onChange={e=>setMatForm({...matForm,name:e.target.value})}/>
                <datalist id="plastics-dl">{COMMON_PLASTICS.map(p=><option key={p} value={p}/>)}</datalist>
              </div>
              <div className="form-field">
                <label>Weight in grams <span className="pt-req">*</span></label>
                <div className="pt-unit-row">
                  <input type="number" min="0.001" step="any" placeholder="0" value={matForm.weight} onChange={e=>setMatForm({...matForm,weight:e.target.value})}/>
                  <span className="pt-unit-badge">g</span>
                </div>
                <span style={{fontSize:'0.72rem',color:'var(--gray-400)'}}>Percentage is calculated automatically from weights.</span>
              </div>
              <div className="form-field">
                <label>Material Image (optional)</label>
                <UploadZone value={matForm.image} onChange={v=>setMatForm({...matForm,image:v})} onError={msg=>onToast(msg,'error')}/>
              </div>
            </div>
          </div>
          <div className="pt-modal-footer">
            <button className="btn btn-secondary" onClick={()=>setShowAddMat(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddMat}>Add Material</button>
          </div>
        </Modal>
      )}

      {/* Confirm Delete */}
      {deleteProd && (
        <Modal onClose={()=>setDeleteProd(null)} small>
          <div className="pt-delete-body">
            <div className="pt-delete-icon">🗑️</div>
            <h3 className="pt-delete-title">Delete "{deleteProd.name}"?</h3>
            <p className="pt-delete-desc">This will permanently remove the product and all {deleteProd.materials.length} material entries. This action cannot be undone.</p>
            <div className="pt-modal-footer">
              <button className="btn btn-secondary" onClick={()=>setDeleteProd(null)}>Cancel</button>
              <button className="btn" style={{background:'var(--danger)',color:'#fff',borderColor:'var(--danger)'}} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Material Library */}
      {showLibrary && (
        <Modal onClose={()=>setShowLibrary(false)}>
          <div className="pt-modal-header">
            <h2 className="pt-modal-title">🧪 Material Library</h2>
            <button className="close-btn" onClick={()=>setShowLibrary(false)}>×</button>
          </div>
          <div className="pt-modal-body">
            <div className="pt-lib-stats">
              {[[library.length,'Unique Materials'],[library.reduce((s,e)=>s+e.usedIn.length,0),'Product Usages'],[library.filter(e=>e.image).length,'With Images']].map(([v,l])=>(
                <div key={l} className="pt-lib-chip"><strong>{v}</strong><span>{l}</span></div>
              ))}
            </div>
            <div style={{margin:'14px 0 10px'}}>
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input className="search-input" placeholder="Search materials…" value={libAdminQ} onChange={e=>setLibAdminQ(e.target.value)}/>
              </div>
            </div>
            {library.filter(e=>!libAdminQ||e.name.toLowerCase().includes(libAdminQ.toLowerCase())).length === 0
              ? <div className="pt-empty-state" style={{minHeight:'140px'}}><span style={{fontSize:'2rem'}}>🧪</span><p>No materials in library yet.</p><p style={{fontSize:'0.8rem',color:'var(--gray-400)'}}>Add via product forms.</p></div>
              : (
                <div className="pt-lib-grid">
                  {library.filter(e=>!libAdminQ||e.name.toLowerCase().includes(libAdminQ.toLowerCase())).map((e,i)=>(
                    <div key={e.id} className="pt-lib-card" style={{'--mat-accent':COLORS[i%COLORS.length]}}>
                      <div className="pt-lib-card-bar"/>
                      {e.image && <img src={e.image} alt={e.name} className="pt-lib-card-img"/>}
                      <span className="pt-lib-card-name">{e.name}</span>
                      <span className="badge">Plastic</span>
                      <span className="pt-lib-card-usage">{e.usedIn.length} product{e.usedIn.length!==1?'s':''}</span>
                      <button className="pt-lib-card-del" onClick={()=>delFromLib(e.id)} title="Delete">🗑</button>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </Modal>
      )}

      {/* Pick from Library */}
      {showPickLib && (
        <Modal onClose={()=>{setShowPickLib(false);setPickedLib(null);setPickWeight('');}} small>
          <div className="pt-modal-header">
            <h2 className="pt-modal-title">Pick from Library</h2>
            <button className="close-btn" onClick={()=>{setShowPickLib(false);setPickedLib(null);setPickWeight('');}}>×</button>
          </div>
          <div className="pt-modal-body">
            {!pickedLib ? (
              <>
                <div style={{marginBottom:'10px'}}>
                  <div className="search-input-wrapper">
                    <span className="search-icon">🔍</span>
                    <input className="search-input" placeholder="Search…" value={libQ} onChange={e=>setLibQ(e.target.value)}/>
                  </div>
                </div>
                <div className="pt-lib-pick-grid">
                  {library.filter(e=>!libQ||e.name.toLowerCase().includes(libQ.toLowerCase())).map((e,i)=>(
                    <div key={e.id} className="pt-lib-pick-card" style={{'--mat-accent':COLORS[i%COLORS.length]}} onClick={()=>setPickedLib(e)}>
                      <div className="pt-lib-card-bar"/>
                      <span className="pt-lib-pick-name">{e.name}</span>
                      <span className="pt-lib-pick-use">{e.usedIn.length} product{e.usedIn.length!==1?'s':''}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="pt-pick-selected">
                <div className="pt-pick-banner">✓ {pickedLib.name}</div>
                <div className="form-field" style={{marginTop:'16px'}}>
                  <label>Weight (grams) <span className="pt-req">*</span></label>
                  <div className="pt-unit-row">
                    <input type="number" min="0.001" step="any" placeholder="0" value={pickWeight} onChange={e=>setPickWeight(e.target.value)} autoFocus/>
                    <span className="pt-unit-badge">g</span>
                  </div>
                </div>
                <div className="pt-modal-footer" style={{paddingTop:'12px'}}>
                  <button className="btn btn-secondary" onClick={()=>setPickedLib(null)}>Back</button>
                  <button className="btn btn-primary" onClick={handlePickLib}>Add to Product</button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

    </div>
  );
}
