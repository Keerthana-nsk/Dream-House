const parseBtn = document.getElementById('parseBtn');
const regenBtn = document.getElementById('regenBtn');
const saveBtn = document.getElementById('saveBtn');
const exportPngBtn = document.getElementById('exportPng');
const floorSvg = document.getElementById('floorSvg');

const view2dRadio = document.getElementById('view2d');
const view3dRadio = document.getElementById('view3d');
const svgWrap = document.getElementById('svgWrap');
const threeWrap = document.getElementById('threeWrap');

// Handle switching between 2D and 3D
view2dRadio.addEventListener("change", () => {
    if (view2dRadio.checked) {
        svgWrap.classList.remove("hidden");
        threeWrap.classList.add("hidden");
    }
});

view3dRadio.addEventListener("change", () => {
    if (view3dRadio.checked) {
        svgWrap.classList.add("hidden");
        threeWrap.classList.remove("hidden");
        show3DLayout();  // 👈 Call your fixed function
    }
});

function collectFromForm(){
  return {
    name: document.getElementById('projectName').value || 'My Dream House',
    prompt: document.getElementById('prompt').value || '',
    bedrooms: parseInt(document.getElementById('bedrooms').value)||0,
    bathrooms: parseInt(document.getElementById('bathrooms').value)||0,
    kitchens: parseInt(document.getElementById('kitchens').value)||0,
    halls: parseInt(document.getElementById('halls').value)||0,
    balcony: document.getElementById('balcony').checked,
    garden: document.getElementById('garden').checked,
    parking: document.getElementById('parking').checked,
    style: document.getElementById('styleSelect').value,
    color: document.getElementById('primaryColor').value || '#8fbf8f'
  }
}

async function generateFromPrompt(){
  const name = document.getElementById('projectName').value || 'My Dream House';
  const prompt = document.getElementById('prompt').value || '';
  const res = await fetch('/api/generate', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({name, prompt})});
  const j = await res.json();
  if(j.ok){
    // fill parsed fields
    const p = j.parsed;
    document.getElementById('bedrooms').value = p.bedrooms||1;
    document.getElementById('bathrooms').value = p.bathrooms||0;
    document.getElementById('kitchens').value = p.kitchens||1;
    document.getElementById('halls').value = p.halls||1;
    document.getElementById('balcony').checked = p.balcony;
    document.getElementById('garden').checked = p.garden;
    document.getElementById('parking').checked = p.parking;
    document.getElementById('styleSelect').value = p.style||'modern';
    renderLayout(j.layout, document.getElementById('primaryColor').value);
    // also render 3D
    if (window.renderThree) window.renderThree(j.layout, document.getElementById('primaryColor').value);
    // store current layout
    window.currentLayout = j.layout;
  }
}

function clearSVG(){ while(floorSvg.firstChild) floorSvg.removeChild(floorSvg.firstChild); }
function createSVG(tag, attrs){ const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for(let k in attrs) el.setAttribute(k, attrs[k]); return el; }

function renderLayout(layout, color){
  clearSVG();
  document.getElementById('viewerTitle').textContent = 'Preview — ' + (layout.name||'');
  const rooms = layout.rooms || [];
  const extras = layout.extras || [];
  const svgW = 1000, svgH = 600;
  const padding = 20;
  const cols = 3;
  const perCol = Math.ceil(rooms.length / cols) || 1;
  const usableW = svgW - padding*2;
  const usableH = svgH - padding*2;
  const boxW = Math.floor(usableW / cols) - 20;
  const boxH = Math.floor(usableH / perCol) - 20;

  let i=0;
  for(let c=0;c<cols;c++){
    for(let r=0;r<perCol;r++){
      if(i>=rooms.length) break;
      const x = padding + c*(boxW+20);
      const y = padding + r*(boxH+20);
      const room = rooms[i];
      // draw stylized room with inner padding to look like walls
      const outer = createSVG('rect',{x:x,y:y,width:boxW,height:boxH, fill:'#ffffff', stroke:'#333', 'stroke-width':2, rx:8, ry:8});
      floorSvg.appendChild(outer);
      const inner = createSVG('rect',{x:x+8,y:y+8,width:boxW-16,height:boxH-16, fill:color, rx:6, ry:6});
      floorSvg.appendChild(inner);

      // add simple icons (emoji) using text - works cross-platform in browsers
      const iconMap = { 'Bedroom':'🛏', 'Bathroom':'🚽', 'Kitchen':'🍳', 'Hall':'🛋' };
      const icon = iconMap[room.type] || '📐';
      const iconText = createSVG('text',{x: x + boxW/2 - 12, y: y + boxH/2 + 8, 'font-size':32});
      iconText.textContent = icon;
      floorSvg.appendChild(iconText);

      const label = createSVG('text',{x:x+12,y:y+24, fill:'#111', 'class':'room-label'});
      label.textContent = room.type;
      floorSvg.appendChild(label);

      const idText = createSVG('text',{x:x+12,y:y+44, fill:'#111', 'class':'room-label'});
      idText.style.fontSize='12px'; idText.textContent = room.id;
      floorSvg.appendChild(idText);
      i++;
    }
  }

  // extras: icons / patches at bottom
  let exX = padding;
  extras.forEach(ex=>{
    if(ex.type === 'Garden'){
      const g = createSVG('rect',{x:exX,y:svgH-100,width:120,height:60, fill:'#a6d96a', rx:6, ry:6});
      floorSvg.appendChild(g);
      const gt = createSVG('text',{x:exX+12,y:svgH-100+36}); gt.textContent = '🌳 Garden'; floorSvg.appendChild(gt);
    } else if(ex.type === 'Parking'){
      const p = createSVG('rect',{x:exX,y:svgH-100,width:120,height:60, fill:'#ddd', rx:6, ry:6});
      floorSvg.appendChild(p);
      const pt = createSVG('text',{x:exX+12,y:svgH-100+36}); pt.textContent = '🚗 Parking'; floorSvg.appendChild(pt);
    } else if(ex.type === 'Balcony'){
      const b = createSVG('rect',{x:exX,y:svgH-100,width:120,height:60, fill:'#ffdca6', rx:6, ry:6});
      floorSvg.appendChild(b);
      const bt = createSVG('text',{x:exX+12,y:svgH-100+36}); bt.textContent = '🏖 Balcony'; floorSvg.appendChild(bt);
    }
    exX += 140;
  });
}

// regenerate from form fields (after user edits numbers)
function regenerateFromForm(){
  const f = collectFromForm();
  const layout = {name: f.name, rooms: [], extras: [], style:f.style};
  for(let i=0;i<(f.bedrooms||0);i++) layout.rooms.push({type:'Bedroom',id:'Bed'+(i+1)});
  for(let i=0;i<(f.bathrooms||0);i++) layout.rooms.push({type:'Bathroom',id:'Bath'+(i+1)});
  for(let i=0;i<(f.kitchens||0);i++) layout.rooms.push({type:'Kitchen',id:'Kit'+(i+1)});
  for(let i=0;i<(f.halls||0);i++) layout.rooms.push({type:'Hall',id:'Hall'+(i+1)});
  if(f.balcony) layout.extras.push({type:'Balcony'});
  if(f.garden) layout.extras.push({type:'Garden'});
  if(f.parking) layout.extras.push({type:'Parking'});
  renderLayout(layout, f.color);
  // store current layout to window so save can use it
  window.currentLayout = layout;
  // also update 3D preview
  if (window.renderThree) window.renderThree(layout, f.color);
}

// save design via API
async function saveDesign(){
  const f = collectFromForm();
  const layout = window.currentLayout || {};
  const res = await fetch('/api/save', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({name:f.name, prompt:f.prompt, layout})});
  const j = await res.json();
  if(j.ok){ alert('Saved'); loadSavedList(); }
}

async function loadSavedList(){
  const res = await fetch('/api/list'); const j = await res.json();
  const ul = document.getElementById('savedList'); ul.innerHTML='';
  if(j.ok){ j.designs.forEach(d=>{ const li = document.createElement('li'); li.textContent = d.name + ' — ' + new Date(d.created_at).toLocaleString(); const b=document.createElement('button'); b.textContent='Load'; b.onclick=async ()=>{ const r=await fetch('/api/get/'+d.id); const jr=await r.json(); if(jr.ok){ document.getElementById('projectName').value = jr.design.name; document.getElementById('prompt').value = jr.design.prompt; window.currentLayout = jr.design.data; // populate form fields roughly
        const rooms = jr.design.data.rooms||[]; const counts={Bedroom:0,Bathroom:0,Kitchen:0,Hall:0}; rooms.forEach(rm=>counts[rm.type] = (counts[rm.type]||0)+1);
        document.getElementById('bedrooms').value = counts.Bedroom||0; document.getElementById('bathrooms').value = counts.Bathroom||0; document.getElementById('kitchens').value = counts.Kitchen||0; document.getElementById('halls').value = counts.Hall||0; renderLayout(window.currentLayout, document.getElementById('primaryColor').value);
        if (window.renderThree) window.renderThree(window.currentLayout, document.getElementById('primaryColor').value);
      }}; li.appendChild(b); ul.appendChild(li); }) }
}

// export PNG using html2canvas
function exportPNG(){
  const wrap = document.getElementById('previewArea');
  html2canvas(wrap).then(canvas=>{
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = (document.getElementById('projectName').value || 'dream-house') + '.png'; a.click();
  });
}

// view toggle events
view2dRadio.addEventListener('change', ()=>{ if(view2dRadio.checked){ svgWrap.classList.remove('hidden'); threeWrap.classList.add('hidden'); }});
view3dRadio.addEventListener('change', ()=>{ if(view3dRadio.checked){ svgWrap.classList.add('hidden'); threeWrap.classList.remove('hidden'); }});

// events
parseBtn.addEventListener('click', generateFromPrompt);
regenBtn.addEventListener('click', ()=>{ regenerateFromForm(); window.currentLayout = window.currentLayout||{} });
saveBtn.addEventListener('click', saveDesign);
exportPngBtn.addEventListener('click', exportPNG);

// initial
regenerateFromForm();
loadSavedList();

function show3DLayout() {
    const container = document.getElementById("layoutPreview");
    container.innerHTML = ""; // Clear old content

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Camera
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(5, 5, 10);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Light
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5).normalize();
    scene.add(light);

    // Floor (green for garden)
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x77dd77 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Example house: simple box walls + roof
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const wallGeometry = new THREE.BoxGeometry(6, 3, 6);
    const walls = new THREE.Mesh(wallGeometry, wallMaterial);
    walls.position.y = 1.5;
    scene.add(walls);

    // Roof (pyramid)
    const roofGeometry = new THREE.ConeGeometry(5, 2, 4);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0xff5555 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 4;
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);

    // Controls (orbit view)
    const controls = new THREE.OrbitControls(camera, renderer.domElement);

    // Animate
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Resize fix
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// ===================
// Handle prompt input
// ===================
document.getElementById("houseForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prompt = document.getElementById("prompt").value;

    const res = await fetch("/parse_prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
    });
    const data = await res.json();

    document.getElementById("bedrooms").value = data.bedrooms;
    document.getElementById("kitchens").value = data.kitchens;
    document.getElementById("bathrooms").value = data.bathrooms;
    document.getElementById("living_rooms").value = data.living_rooms;

    generateLayout();
});

// ===================
// Generate Layout (2D)
// ===================
function generateLayout() {
    const bedrooms = +document.getElementById("bedrooms").value;
    const kitchens = +document.getElementById("kitchens").value;
    const bathrooms = +document.getElementById("bathrooms").value;
    const livingRooms = +document.getElementById("living_rooms").value;

    const layout = { bedrooms, kitchens, bathrooms, livingRooms };

    show2DLayout(layout);
}

// ===================
// 2D View with Icons
// ===================
function show2DLayout(layout) {
    const container = document.getElementById("layoutPreview");
    container.innerHTML = "";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "400");

    let x = 10;
    let y = 10;

    function drawRoom(label, count, color, icon) {
        for (let i = 0; i < count; i++) {
            const rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("x", x);
            rect.setAttribute("y", y);
            rect.setAttribute("width", 100);
            rect.setAttribute("height", 80);
            rect.setAttribute("fill", color);
            rect.setAttribute("stroke", "black");
            rect.setAttribute("stroke-width", "2");
            svg.appendChild(rect);

            const text = document.createElementNS(svgNS, "text");
            text.setAttribute("x", x + 10);
            text.setAttribute("y", y + 45);
            text.setAttribute("font-size", "14");
            text.textContent = icon + " " + label;
            svg.appendChild(text);

            x += 120;
            if (x > 400) {
                x = 10;
                y += 100;
            }
        }
    }

    drawRoom("Bedroom", layout.bedrooms, "#ffdddd", "🛏");
    drawRoom("Kitchen", layout.kitchens, "#ddffdd", "🍳");
    drawRoom("Bathroom", layout.bathrooms, "#ddddff", "🚽");
    drawRoom("Living", layout.livingRooms, "#fff0aa", "🛋");

    container.appendChild(svg);
}

// ===================
// 3D View with Three.js
// ===================
function show3DLayout() {
    const container = document.getElementById("threeContainer");
    container.innerHTML = ""; // Clear old content

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Camera
    const camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(5, 5, 10);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Light
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5).normalize();
    scene.add(light);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x77dd77 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // House walls
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const wallGeometry = new THREE.BoxGeometry(6, 3, 6);
    const walls = new THREE.Mesh(wallGeometry, wallMaterial);
    walls.position.y = 1.5;
    scene.add(walls);

    // Roof
    const roofGeometry = new THREE.ConeGeometry(5, 2, 4);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0xff5555 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 4;
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);

    // Orbit Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Resize handling
    window.addEventListener("resize", () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// ===================
// Toggle Views
// ===================
document.getElementById("view2D")?.addEventListener("click", generateLayout);
document.getElementById("view3D")?.addEventListener("click", show3DLayout);
