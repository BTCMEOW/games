// Game constants
const WIDTH = 800;
const HEIGHT = 600;
const GROUND_LEVEL = 500;
const PLAYER_START_X = 100;
const PLAYER_MAX_HEALTH = 200;
const PLAYER_LIVES = 3;
const GRAVITY = 0.8;
const JUMP_STRENGTH = -15;
const PLAYER_SPEED = 5;
const ENEMY_SPEED_MIN = 2;
const ENEMY_SPEED_MAX = 4;
const BASE_ENEMY_SPAWN_RATE = 2000;
const SCORE_THRESHOLD = 5000;
const MAX_ENEMIES = 10;
const PARTICLE_LIMIT = 100;
const INVISIBILITY_DURATION = 5;
const INVISIBILITY_COOLDOWN = 10;

// Game state
let canvas, ctx;
let player, enemies = [];
let score = 0;
let gameActive = false;
let lastEnemySpawn = 0;
let particles = [];
let backgroundOffset = 0;
let time = 0;

// Stars & clouds for parallax
let stars = [];
let clouds = [];
let mountains = [];

// Procedural textures (offscreen canvases)
let groundTexture, skyTexture, moonGlow;

// Particle colors
const PARTICLE_COLORS = {
    jump: '#c8e6ff',
    hit: '#ff4444',
    heal: '#44ff88',
    score: '#ffd700',
    invisibility: '#8844ff',
    slash: '#ffffff',
    ember: '#ff8800'
};

// ─── Texture generation ──────────────────────────────────────────────────────

function buildGroundTexture() {
    const tc = document.createElement('canvas');
    tc.width = 800; tc.height = 100;
    const tx = tc.getContext('2d');
    // Base dark stone
    const grd = tx.createLinearGradient(0, 0, 0, 100);
    grd.addColorStop(0, '#2a2a3a');
    grd.addColorStop(0.15, '#1e1e2c');
    grd.addColorStop(1, '#12121a');
    tx.fillStyle = grd;
    tx.fillRect(0, 0, 800, 100);
    // Stone tiles
    tx.strokeStyle = 'rgba(80,80,120,0.35)';
    tx.lineWidth = 1;
    for (let x = 0; x < 800; x += 60) {
        for (let y = 0; y < 100; y += 30) {
            const ox = (Math.floor(y / 30) % 2) * 30;
            tx.strokeRect(x + ox, y, 60, 30);
            // subtle highlight
            tx.fillStyle = 'rgba(120,120,180,0.06)';
            tx.fillRect(x + ox + 2, y + 2, 56, 10);
        }
    }
    // Glowing cracks
    tx.strokeStyle = 'rgba(160,80,255,0.18)';
    tx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
        tx.beginPath();
        const sx = Math.random() * 800;
        tx.moveTo(sx, 0);
        tx.lineTo(sx + (Math.random() - 0.5) * 20, 50 + Math.random() * 50);
        tx.stroke();
    }
    // Top edge glow
    const edgeGrd = tx.createLinearGradient(0, 0, 0, 8);
    edgeGrd.addColorStop(0, 'rgba(140,80,255,0.5)');
    edgeGrd.addColorStop(1, 'transparent');
    tx.fillStyle = edgeGrd;
    tx.fillRect(0, 0, 800, 8);
    return tc;
}

function buildSkyTexture() {
    const tc = document.createElement('canvas');
    tc.width = 800; tc.height = 500;
    const tx = tc.getContext('2d');
    const grd = tx.createLinearGradient(0, 0, 0, 500);
    grd.addColorStop(0, '#050510');
    grd.addColorStop(0.5, '#0d0d28');
    grd.addColorStop(1, '#1a0a2e');
    tx.fillStyle = grd;
    tx.fillRect(0, 0, 800, 500);
    return tc;
}

function buildMoonGlow() {
    const tc = document.createElement('canvas');
    tc.width = 200; tc.height = 200;
    const tx = tc.getContext('2d');
    // Outer glow
    const rg = tx.createRadialGradient(100, 100, 30, 100, 100, 100);
    rg.addColorStop(0, 'rgba(200,180,255,0.4)');
    rg.addColorStop(0.5, 'rgba(160,100,255,0.1)');
    rg.addColorStop(1, 'transparent');
    tx.fillStyle = rg;
    tx.fillRect(0, 0, 200, 200);
    // Moon disc
    const rg2 = tx.createRadialGradient(95, 90, 5, 100, 100, 35);
    rg2.addColorStop(0, '#ffffff');
    rg2.addColorStop(0.4, '#e8d8ff');
    rg2.addColorStop(1, '#c8a0e8');
    tx.fillStyle = rg2;
    tx.beginPath();
    tx.arc(100, 100, 35, 0, Math.PI * 2);
    tx.fill();
    // Craters
    tx.fillStyle = 'rgba(120,80,180,0.25)';
    [[85,88,6],[110,105,4],[95,115,3],[115,90,5]].forEach(([cx,cy,r]) => {
        tx.beginPath(); tx.arc(cx,cy,r,0,Math.PI*2); tx.fill();
    });
    return tc;
}

function initBackground() {
    groundTexture = buildGroundTexture();
    skyTexture = buildSkyTexture();
    moonGlow = buildMoonGlow();

    // Stars
    for (let i = 0; i < 180; i++) {
        stars.push({
            x: Math.random() * WIDTH,
            y: Math.random() * 380,
            r: Math.random() * 1.4 + 0.3,
            alpha: Math.random() * 0.7 + 0.3,
            twinkleSpeed: Math.random() * 2 + 0.5,
            twinklePhase: Math.random() * Math.PI * 2
        });
    }
    // Clouds (nebula wisps)
    for (let i = 0; i < 6; i++) {
        clouds.push({
            x: Math.random() * WIDTH * 1.5,
            y: 40 + Math.random() * 200,
            w: 120 + Math.random() * 200,
            h: 30 + Math.random() * 50,
            alpha: 0.04 + Math.random() * 0.07,
            speed: 0.2 + Math.random() * 0.3,
            hue: Math.random() < 0.5 ? 270 : 200
        });
    }
    // Mountains (silhouettes, 2 layers)
    mountains = [
        { pts: genMountain(0, 350, 900, 480, 8, 0.35), color: '#0e0e22', speed: 0.15 },
        { pts: genMountain(0, 390, 900, 500, 12, 0.45), color: '#12102a', speed: 0.35 }
    ];
}

function genMountain(x0, yBase, width, yMax, peaks, roughness) {
    const pts = [];
    const step = width / peaks;
    pts.push({x: x0, y: yBase});
    for (let i = 0; i <= peaks; i++) {
        const px = x0 + i * step;
        const py = yBase - Math.abs(Math.sin(i * 0.9 + roughness * 10)) * (yBase - yMax)
                    * (0.5 + Math.random() * 0.5);
        pts.push({x: px, y: py});
    }
    pts.push({x: x0 + width, y: yBase});
    return pts;
}

// ─── Background draw ─────────────────────────────────────────────────────────

function drawBackground() {
    // Sky
    ctx.drawImage(skyTexture, 0, 0, WIDTH, HEIGHT);

    // Moon
    const moonX = WIDTH * 0.82, moonY = 60;
    ctx.drawImage(moonGlow, moonX - 100, moonY - 100, 200, 200);

    // Stars (twinkle)
    stars.forEach(s => {
        const a = s.alpha * (0.6 + 0.4 * Math.sin(time * s.twinkleSpeed + s.twinklePhase));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });

    // Nebula clouds
    clouds.forEach(c => {
        c.x -= c.speed;
        if (c.x + c.w < 0) c.x = WIDTH + c.w * 0.5;
        const rg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.w * 0.5);
        rg.addColorStop(0, `hsla(${c.hue},80%,65%,${c.alpha * 2})`);
        rg.addColorStop(1, `hsla(${c.hue},60%,40%,0)`);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w * 0.5, c.h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // Mountains parallax
    mountains.forEach(m => {
        const off = (backgroundOffset * m.speed) % WIDTH;
        [-off, WIDTH - off].forEach(dx => {
            ctx.fillStyle = m.color;
            ctx.beginPath();
            ctx.moveTo(m.pts[0].x + dx, m.pts[0].y);
            m.pts.forEach(p => ctx.lineTo(p.x + dx, p.y));
            ctx.closePath();
            ctx.fill();
        });
    });

    // Atmospheric haze near ground
    const haze = ctx.createLinearGradient(0, 400, 0, GROUND_LEVEL);
    haze.addColorStop(0, 'transparent');
    haze.addColorStop(1, 'rgba(80,40,140,0.18)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 400, WIDTH, GROUND_LEVEL - 400);

    // Ground texture (tiled)
    const gOff = Math.floor(backgroundOffset) % 800;
    ctx.drawImage(groundTexture, -gOff, GROUND_LEVEL, 800, 100);
    ctx.drawImage(groundTexture, 800 - gOff, GROUND_LEVEL, 800, 100);

    // Ground top glow pulse
    const glowAlpha = 0.25 + 0.1 * Math.sin(time * 1.5);
    const groundGlow = ctx.createLinearGradient(0, GROUND_LEVEL - 6, 0, GROUND_LEVEL + 4);
    groundGlow.addColorStop(0, `rgba(160,80,255,${glowAlpha})`);
    groundGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = groundGlow;
    ctx.fillRect(0, GROUND_LEVEL - 6, WIDTH, 10);
}

// ─── Player drawing ───────────────────────────────────────────────────────────

function drawCat(p) {
    const x = p.x, y = p.y, w = p.width, h = p.height;
    const dir = p.facingRight ? 1 : -1;

    ctx.save();
    if (!p.facingRight) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.translate(-w * 0, 0);
    } else {
        ctx.translate(x, y);
    }

    // invisibility shimmer
    if (p.hidden) {
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 8);
    } else if (p.hitFlashTimer > 0) {
        ctx.globalAlpha = 0.5;
    }

    const runCycle = Math.sin(time * 14) * (p.velocityX !== 0 ? 1 : 0);
    const idleBob = Math.sin(time * 2) * 1.5;
    const jumpTilt = p.jumping ? -0.15 : 0;

    ctx.save();
    ctx.translate(w * 0.5, h * 0.5 + idleBob);
    ctx.rotate(jumpTilt + runCycle * 0.04);

    // Shadow under cat
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.45, w * 0.4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Tail ──
    const tailWag = Math.sin(time * 3 + 1) * 0.4;
    const tailBase = { x: -w * 0.45, y: h * 0.15 };
    ctx.strokeStyle = '#c87030';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(tailBase.x, tailBase.y);
    ctx.quadraticCurveTo(
        tailBase.x - 18, tailBase.y - 20 + tailWag * 15,
        tailBase.x - 10, tailBase.y - 38 + tailWag * 25
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Body ──
    const bodyGrd = ctx.createRadialGradient(-3, -5, 2, 0, 5, w * 0.42);
    bodyGrd.addColorStop(0, '#f0a860');
    bodyGrd.addColorStop(0.5, '#e07828');
    bodyGrd.addColorStop(1, '#8a3a08');
    ctx.fillStyle = bodyGrd;
    ctx.shadowColor = 'rgba(255,120,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 8, w * 0.38, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Belly stripe
    ctx.fillStyle = 'rgba(255,220,160,0.55)';
    ctx.beginPath();
    ctx.ellipse(2, 14, w * 0.18, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stripes on body
    ctx.strokeStyle = 'rgba(120,50,0,0.35)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    [-8, 2, 12].forEach(sy => {
        ctx.beginPath();
        ctx.moveTo(-w * 0.3, sy); ctx.lineTo(-w * 0.1, sy - 4);
        ctx.stroke();
    });

    // ── Legs ──
    const legSwing = Math.sin(time * 14) * (p.velocityX !== 0 ? 12 : 0);
    const legColor = '#c07028';
    [
        { bx: -w * 0.22, by: h * 0.32, sw: legSwing },
        { bx:  w * 0.1,  by: h * 0.32, sw: -legSwing },
        { bx: -w * 0.14, by: h * 0.32, sw: legSwing * 0.7 },
        { bx:  w * 0.22, by: h * 0.32, sw: -legSwing * 0.7 }
    ].forEach(leg => {
        ctx.fillStyle = legColor;
        ctx.beginPath();
        ctx.roundRect(leg.bx - 5, leg.by, 10, 18 + leg.sw * 0.3, 4);
        ctx.fill();
    });

    // ── Head ──
    ctx.save();
    ctx.translate(w * 0.28, -h * 0.25 + idleBob * 0.3);
    const headGrd = ctx.createRadialGradient(-4, -4, 2, 0, 0, 20);
    headGrd.addColorStop(0, '#f8b870');
    headGrd.addColorStop(0.6, '#e07828');
    headGrd.addColorStop(1, '#8a3a08');
    ctx.fillStyle = headGrd;
    ctx.shadowColor = 'rgba(255,150,50,0.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ears
    [[−10, −18], [10, −18]].forEach(([ex, ey]) => {
        ctx.fillStyle = '#c06020';
        ctx.beginPath();
        ctx.moveTo(ex - 7, ey + 8); ctx.lineTo(ex, ey - 2); ctx.lineTo(ex + 7, ey + 8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff9090';
        ctx.beginPath();
        ctx.moveTo(ex - 4, ey + 7); ctx.lineTo(ex, ey); ctx.lineTo(ex + 4, ey + 7);
        ctx.closePath(); ctx.fill();
    });

    // Eyes
    const eyeBlink = (Math.floor(time * 0.8) % 5 === 0) ? 0.1 : 1;
    [-7, 7].forEach(ex => {
        // Eye white / iris
        ctx.fillStyle = '#1a0a2e';
        ctx.beginPath();
        ctx.ellipse(ex, -2, 5, 6 * eyeBlink, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pupil glow
        ctx.fillStyle = p.hidden ? '#8844ff' : (p.attacking ? '#ff4400' : '#88ffcc');
        ctx.shadowColor = p.hidden ? '#8844ff' : '#44ffaa';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(ex, -2, 2.5, 4 * eyeBlink, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Nose
    ctx.fillStyle = '#ff7070';
    ctx.beginPath();
    ctx.arc(0, 3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = 'rgba(255,240,200,0.7)';
    ctx.lineWidth = 0.8;
    [[-3, 4], [-3, 7], [-3, 10]].forEach(([mx, my]) => {
        ctx.beginPath(); ctx.moveTo(mx, my - 6); ctx.lineTo(mx - 22, my - 3 + Math.random() * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-mx, my - 6); ctx.lineTo(-mx + 22, my - 3 + Math.random() * 2); ctx.stroke();
    });

    ctx.restore(); // head

    // ── Attack effect ──
    if (p.attacking) {
        const slashX = w * 0.38;
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#aaffff';
        ctx.shadowBlur = 20;
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(slashX + 5, -5 + i * 8, 22, -0.5 + i * 0.15, Math.PI * 0.5 + i * 0.1);
            ctx.stroke();
        }
        ctx.restore();
    }

    ctx.restore(); // body transform

    // ── Invisibility aura ──
    if (p.hidden) {
        ctx.strokeStyle = `hsla(270,80%,70%,${0.3 + 0.2 * Math.sin(time * 6)})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#8844ff';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.4, w * 0.52, h * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    ctx.restore(); // flip

    // ── Particles ──
    p.particles.forEach(pt => pt.draw());
}

// ─── Enemy drawing ────────────────────────────────────────────────────────────

function drawEnemy(e) {
    const x = e.x, y = e.y, w = e.width, h = e.height;

    // Particles
    e.particles.forEach(pt => pt.draw());

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h + 3, w * 0.4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x + w * 0.5, y + h * 0.5);

    if (e.hitFlashTimer > 0) {
        ctx.globalAlpha = 0.5;
    }

    const hover = Math.sin(time * 3 + e.x * 0.01) * 2;
    ctx.translate(0, hover);

    if (e.type === 'strong') {
        drawDemon(w, h, e);
    } else {
        drawSkeleton(w, h, e);
    }

    ctx.restore();

    // Health bar
    const bw = w * 0.9, bh = 5;
    const bx = x + w * 0.05, by = y - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    // BG track
    ctx.fillStyle = '#330011';
    ctx.fillRect(bx, by, bw, bh);
    // Fill
    const pct = e.health / e.maxHealth;
    const hueBar = e.type === 'strong' ? 0 : 15;
    ctx.fillStyle = `hsl(${hueBar},90%,${30 + pct * 30}%)`;
    ctx.shadowColor = `hsl(${hueBar},100%,60%)`;
    ctx.shadowBlur = 6;
    ctx.fillRect(bx, by, bw * pct, bh);
    ctx.shadowBlur = 0;
}

function drawSkeleton(w, h) {
    // Body glow
    const bodyGrd = ctx.createRadialGradient(0, 0, 2, 0, 0, w * 0.4);
    bodyGrd.addColorStop(0, '#e8e8f8');
    bodyGrd.addColorStop(0.5, '#a0a8c0');
    bodyGrd.addColorStop(1, '#404058');
    ctx.fillStyle = bodyGrd;
    ctx.shadowColor = 'rgba(150,180,255,0.6)';
    ctx.shadowBlur = 14;

    // Torso
    ctx.beginPath();
    ctx.roundRect(-w * 0.22, -h * 0.22, w * 0.44, h * 0.44, 4);
    ctx.fill();

    // Ribs
    ctx.strokeStyle = 'rgba(60,60,90,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.18, -h * 0.14 + i * 8);
        ctx.lineTo( w * 0.18, -h * 0.14 + i * 8);
        ctx.stroke();
    }

    // Arms (dangling)
    const armSwing = Math.sin(time * 5) * 8;
    [-1, 1].forEach(side => {
        ctx.fillStyle = '#b0b8d0';
        ctx.beginPath();
        ctx.roundRect(side * w * 0.28, -h * 0.18, side * 8, h * 0.35 + armSwing * side, 3);
        ctx.fill();
        // claws
        ctx.fillStyle = '#d0d8e8';
        for (let c = 0; c < 3; c++) {
            ctx.beginPath();
            ctx.moveTo(side * (w * 0.28 + 8), h * 0.14 + armSwing * side + c * 5 - 4);
            ctx.lineTo(side * (w * 0.36 + 6), h * 0.14 + armSwing * side + c * 5);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#c8d0e8';
            ctx.stroke();
        }
    });

    // Legs
    [-1, 1].forEach(side => {
        ctx.fillStyle = '#9098b0';
        ctx.beginPath();
        ctx.roundRect(side * w * 0.12, h * 0.22, side * 10, h * 0.28, 3);
        ctx.fill();
    });

    // Head – skull
    ctx.shadowBlur = 0;
    const headGrd = ctx.createRadialGradient(-3, -h * 0.35, 2, 0, -h * 0.38, 18);
    headGrd.addColorStop(0, '#f0f0ff');
    headGrd.addColorStop(0.7, '#b8bcd8');
    headGrd.addColorStop(1, '#505068');
    ctx.fillStyle = headGrd;
    ctx.shadowColor = 'rgba(180,200,255,0.6)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, -h * 0.38, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eye sockets
    [-6, 6].forEach(ex => {
        ctx.fillStyle = '#080820';
        ctx.beginPath();
        ctx.ellipse(ex, -h * 0.4, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Glowing pupils
        ctx.fillStyle = `hsl(200,80%,${55 + 20 * Math.sin(time * 2)}%)`;
        ctx.shadowColor = '#44aaff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(ex, -h * 0.4, 2, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Jaw crack
    ctx.strokeStyle = 'rgba(50,50,80,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -h * 0.28); ctx.lineTo(0, -h * 0.24); ctx.lineTo(6, -h * 0.28);
    ctx.stroke();
}

function drawDemon(w, h) {
    const pulse = 0.8 + 0.2 * Math.sin(time * 4);

    // Aura
    const auraGrd = ctx.createRadialGradient(0, 0, 10, 0, 0, w * 0.7);
    auraGrd.addColorStop(0, `rgba(255,50,0,${0.15 * pulse})`);
    auraGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGrd;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.7, h * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    [-1, 1].forEach(side => {
        const wingFlap = Math.sin(time * 4 + (side > 0 ? 0.5 : 0)) * 12;
        ctx.fillStyle = `rgba(80,0,10,0.8)`;
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(side * w * 0.25, -h * 0.15);
        ctx.quadraticCurveTo(side * w * 0.75, -h * 0.45 + wingFlap, side * w * 0.65, h * 0.1);
        ctx.quadraticCurveTo(side * w * 0.45, h * 0.05, side * w * 0.25, h * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Wing membrane lines
        ctx.strokeStyle = 'rgba(200,50,20,0.4)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(side * w * 0.25, -h * 0.1);
            ctx.lineTo(side * (w * 0.3 + i * w * 0.1), -h * 0.35 + wingFlap * i * 0.3);
            ctx.stroke();
        }
    });

    // Body
    const bodyGrd = ctx.createRadialGradient(-4, -4, 3, 0, 0, w * 0.38);
    bodyGrd.addColorStop(0, '#cc3010');
    bodyGrd.addColorStop(0.5, '#881008');
    bodyGrd.addColorStop(1, '#3a0505');
    ctx.fillStyle = bodyGrd;
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.ellipse(0, 4, w * 0.36, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Lava cracks on body
    ctx.strokeStyle = `rgba(255,180,0,${0.5 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    [[−8,−10,8,10],[5,−15,−5,8],[−3,5,10,−5]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });

    // Arms with claws
    [-1, 1].forEach(side => {
        ctx.fillStyle = '#6a0808';
        ctx.beginPath();
        ctx.roundRect(side * w * 0.3, -h * 0.1, side * 10, h * 0.35, 3);
        ctx.fill();
        // claws
        for (let c = 0; c < 3; c++) {
            ctx.fillStyle = '#cc2020';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 5;
            ctx.beginPath();
            const cx2 = side * (w * 0.38 + c * 3);
            const cy2 = h * 0.22 + c * 4;
            ctx.moveTo(cx2, cy2);
            ctx.lineTo(cx2 + side * 10, cy2 + 6);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#dd3010';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    });

    // Horns
    [-1, 1].forEach(side => {
        ctx.fillStyle = '#200000';
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(side * 10, -h * 0.48);
        ctx.lineTo(side * 16, -h * 0.7);
        ctx.lineTo(side * 6, -h * 0.52);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Head
    const headGrd = ctx.createRadialGradient(-3, -h * 0.38, 3, 0, -h * 0.38, 20);
    headGrd.addColorStop(0, '#cc3010');
    headGrd.addColorStop(0.7, '#881008');
    headGrd.addColorStop(1, '#3a0505');
    ctx.fillStyle = headGrd;
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, -h * 0.38, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eyes – fiery
    [-7, 7].forEach(ex => {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(ex, -h * 0.4, 5, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // flame iris
        const eyeGrd = ctx.createRadialGradient(ex, -h * 0.4, 0, ex, -h * 0.4, 5);
        eyeGrd.addColorStop(0, '#ffffff');
        eyeGrd.addColorStop(0.3, '#ffee00');
        eyeGrd.addColorStop(0.7, '#ff6600');
        eyeGrd.addColorStop(1, 'transparent');
        ctx.fillStyle = eyeGrd;
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(ex, -h * 0.4, 4, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Mouth with fangs
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -h * 0.3, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = '#ffaa00';
    [[-4, -h * 0.3], [4, -h * 0.3]].forEach(([fx, fy]) => {
        ctx.beginPath();
        ctx.moveTo(fx - 2, fy + 2);
        ctx.lineTo(fx, fy + 8);
        ctx.lineTo(fx + 2, fy + 2);
        ctx.fill();
    });
}

// ─── HUD ─────────────────────────────────────────────────────────────────────

function drawHUD() {
    // Health bar (top-right, stylized)
    const bw = 160, bh = 18;
    const bx = WIDTH - bw - 20, by = 20;
    const pct = player.health / PLAYER_MAX_HEALTH;

    // Outer frame
    ctx.strokeStyle = 'rgba(200,100,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#aa44ff';
    ctx.shadowBlur = 8;
    ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.shadowBlur = 0;

    // Track
    ctx.fillStyle = 'rgba(20,10,40,0.8)';
    ctx.fillRect(bx, by, bw, bh);

    // Health fill gradient
    const hGrd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    const hue = pct > 0.5 ? 120 : pct > 0.25 ? 50 : 0;
    hGrd.addColorStop(0, `hsl(${hue},90%,35%)`);
    hGrd.addColorStop(1, `hsl(${hue + 30},100%,60%)`);
    ctx.fillStyle = hGrd;
    ctx.shadowColor = `hsl(${hue},100%,60%)`;
    ctx.shadowBlur = 10;
    ctx.fillRect(bx, by, bw * pct, bh);
    ctx.shadowBlur = 0;

    // Scanline effect on bar
    for (let sx = 0; sx < bw * pct; sx += 6) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(bx + sx, by, 3, bh);
    }

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px "Courier New"';
    ctx.fillText('HP', bx - 26, by + 13);

    // Level badge
    const lvl = Math.floor(score / SCORE_THRESHOLD) + 1;
    ctx.fillStyle = 'rgba(10,5,30,0.7)';
    ctx.shadowColor = '#8844ff';
    ctx.shadowBlur = 6;
    ctx.fillRect(bx, by + 26, 80, 16);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(120,60,200,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by + 26, 80, 16);
    ctx.fillStyle = '#c884ff';
    ctx.font = '10px "Courier New"';
    ctx.fillText(`LVL ${lvl}  E:${enemies.length}/${getCurrentMaxEnemies()}`, bx + 5, by + 38);

    // Lives (hearts, top-left)
    for (let i = 0; i < player.lives; i++) {
        drawHeart(20 + i * 28, 50, 11, '#ff4444', '#ff8888');
    }

    // Score (styled, top-left)
    ctx.font = 'bold 22px "Courier New"';
    ctx.shadowColor = '#8844ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#e0c8ff';
    ctx.fillText(`${score}`, 20, 34);
    ctx.shadowBlur = 0;

    // Combo
    if (player.comboCount > 0) {
        ctx.save();
        const pulse = 1 + 0.1 * Math.sin(time * 10);
        ctx.translate(20, 90);
        ctx.scale(pulse, pulse);
        ctx.font = 'bold 18px "Courier New"';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`✦ COMBO x${player.comboCount}`, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Invisibility cooldown ring
    if (player.invisibilityCooldown > 0 || player.hidden) {
        const cx2 = 50, cy2 = 130, r2 = 16;
        ctx.strokeStyle = 'rgba(80,40,140,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, Math.PI * 2); ctx.stroke();
        const prog = player.hidden
            ? (player.invisibilityTimer / INVISIBILITY_DURATION)
            : (1 - player.invisibilityCooldown / INVISIBILITY_COOLDOWN);
        ctx.strokeStyle = player.hidden ? '#8844ff' : '#4444ff';
        ctx.shadowColor = '#8844ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cx2, cy2, r2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#a080ff';
        ctx.font = '9px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText('Q', cx2, cy2 + 3);
        ctx.textAlign = 'left';
    }
}

function drawHeart(x, y, r, fillColor, glowColor) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.5);
    ctx.bezierCurveTo(x, y - r * 0.3, x - r, y - r * 0.3, x - r, y + r * 0.2);
    ctx.bezierCurveTo(x - r, y + r, x, y + r * 1.3, x, y + r * 0.5);
    ctx.bezierCurveTo(x, y + r * 1.3, x + r, y + r, x + r, y + r * 0.2);
    ctx.bezierCurveTo(x + r, y - r * 0.3, x, y - r * 0.3, x, y + r * 0.5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
}

// ─── Particle ────────────────────────────────────────────────────────────────

class Particle {
    constructor(x, y, color, opts = {}) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = opts.size || (Math.random() * 3 + 2);
        this.life = 1.0;
        this.decay = opts.decay || (Math.random() * 0.025 + 0.015);
        this.velocityX = opts.vx !== undefined ? opts.vx : (Math.random() - 0.5) * 5;
        this.velocityY = opts.vy !== undefined ? opts.vy : (Math.random() - 0.5) * 5 - 1;
        this.gravity = opts.gravity || 0.12;
        this.glow = opts.glow || false;
    }
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.velocityY += this.gravity;
        this.life -= this.decay;
        return this.life > 0;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        if (this.glow) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
        }
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ─── Player class ─────────────────────────────────────────────────────────────

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 50;
        this.height = 80;
        this.velocityX = 0;
        this.velocityY = 0;
        this.health = PLAYER_MAX_HEALTH;
        this.lives = PLAYER_LIVES;
        this.jumping = false;
        this.attacking = false;
        this.hidden = false;
        this.facingRight = true;
        this.currentState = 'idle';
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.1;
        this.runFrames = [0, 1, 2, 1];
        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.2;
        this.particles = [];
        this.invisibilityTimer = 0;
        this.invisibilityCooldown = 0;
        this.comboCount = 0;
        this.lastAttackTime = 0;
        this.comboTimeout = 1000;
        this.attackRect = { x: 0, y: 0, width: 0, height: 0 };
        this.attackCooldown = 0;
    }

    update(keys) {
        if (this.attackCooldown > 0) this.attackCooldown -= 1/60;

        if (this.hidden) {
            this.invisibilityTimer -= 1/60;
            if (this.invisibilityTimer <= 0) {
                this.hidden = false;
                this.invisibilityCooldown = INVISIBILITY_COOLDOWN;
                for (let i = 0; i < 15; i++) {
                    this.addParticle(this.x + Math.random() * this.width, this.y + Math.random() * this.height, PARTICLE_COLORS.invisibility, { glow: true });
                }
            }
        } else if (this.invisibilityCooldown > 0) {
            this.invisibilityCooldown -= 1/60;
        }

        if (Date.now() - this.lastAttackTime > this.comboTimeout) this.comboCount = 0;

        this.velocityX = 0;
        if (keys.ArrowLeft) { this.velocityX = -PLAYER_SPEED; this.facingRight = false; }
        if (keys.ArrowRight) { this.velocityX = PLAYER_SPEED; this.facingRight = true; }

        this.velocityY += GRAVITY;
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.x = Math.max(0, Math.min(WIDTH - this.width, this.x));

        if (this.y + this.height >= GROUND_LEVEL) {
            if (this.velocityY > 2) {
                // Landing dust
                for (let i = 0; i < 8; i++) {
                    this.addParticle(
                        this.x + Math.random() * this.width,
                        GROUND_LEVEL,
                        '#a080c0',
                        { vy: -Math.random() * 3, vx: (Math.random() - 0.5) * 4, gravity: 0.1, decay: 0.04, size: Math.random() * 4 + 2 }
                    );
                }
            }
            this.y = GROUND_LEVEL - this.height;
            this.velocityY = 0;
            this.jumping = false;
        }

        // Run particles
        if (this.velocityX !== 0 && this.onGround() && Math.random() < 0.3) {
            this.addParticle(
                this.x + this.width * 0.5,
                GROUND_LEVEL,
                '#7050a0',
                { vy: -Math.random() * 2, vx: -this.velocityX * 0.5, gravity: 0.05, decay: 0.05, size: 2 }
            );
        }

        this.animationTimer += 1/60;
        if (this.animationTimer >= this.animationSpeed) {
            this.animationTimer = 0;
            if (this.velocityX !== 0 && this.onGround()) {
                this.animationFrame = (this.animationFrame + 1) % this.runFrames.length;
            }
        }

        if (this.hitFlashTimer > 0) this.hitFlashTimer -= 1/60;
        this.particles = this.particles.filter(p => p.update());

        if (this.attacking) this.currentState = 'attack';
        else if (!this.onGround()) this.currentState = 'jump';
        else if (this.velocityX !== 0) this.currentState = 'run';
        else this.currentState = 'idle';
    }

    toggleInvisibility() {
        if (!this.hidden && this.invisibilityCooldown <= 0) {
            this.hidden = true;
            this.invisibilityTimer = INVISIBILITY_DURATION;
            for (let i = 0; i < 15; i++) {
                this.addParticle(this.x + Math.random() * this.width, this.y + Math.random() * this.height, PARTICLE_COLORS.invisibility, { glow: true });
            }
            return true;
        }
        return false;
    }

    attack() {
        if (!this.attacking && this.attackCooldown <= 0) {
            this.attacking = true;
            this.lastAttackTime = Date.now();
            this.comboCount = (this.comboCount + 1) % 3;
            this.attackCooldown = 0.3;
            const attackWidth = this.width * 1.5;
            this.attackRect = {
                x: this.facingRight ? this.x + this.width : this.x - attackWidth,
                y: this.y,
                width: attackWidth,
                height: this.height
            };
            // Slash particles
            for (let i = 0; i < 8; i++) {
                const dir = this.facingRight ? 1 : -1;
                this.addParticle(
                    this.x + (this.facingRight ? this.width : 0),
                    this.y + this.height * 0.4 + Math.random() * this.height * 0.3,
                    '#ffffff',
                    { vx: dir * (3 + Math.random() * 4), vy: (Math.random() - 0.5) * 3, gravity: 0, decay: 0.06, size: 2 + Math.random() * 2, glow: true }
                );
            }
            setTimeout(() => {
                this.attacking = false;
                this.attackRect = { x: 0, y: 0, width: 0, height: 0 };
            }, 300);
            return true;
        }
        return false;
    }

    takeDamage(amount) {
        if (!this.hidden) {
            this.health -= amount;
            this.hitFlashTimer = this.hitFlashDuration;
            // Screen shake
            screenShake(4, 0.2);
            for (let i = 0; i < 10; i++) {
                this.addParticle(
                    this.x + Math.random() * this.width,
                    this.y + Math.random() * this.height,
                    '#ff4444',
                    { glow: true, decay: 0.03 }
                );
            }
            if (this.health <= 0) {
                this.lives--;
                this.health = PLAYER_MAX_HEALTH;
                if (this.lives <= 0) return true;
            }
        }
        return false;
    }

    getAttackDamage() { return 10 + (this.comboCount * 5); }
    onGround() { return this.y + this.height >= GROUND_LEVEL; }

    jump() {
        if (this.onGround() && !this.jumping) {
            this.velocityY = JUMP_STRENGTH;
            this.jumping = true;
            for (let i = 0; i < 10; i++) {
                this.addParticle(
                    this.x + Math.random() * this.width,
                    GROUND_LEVEL,
                    '#c8a0ff',
                    { vy: -Math.random() * 3, vx: (Math.random() - 0.5) * 5, gravity: 0.08, decay: 0.04, size: 3, glow: true }
                );
            }
            return true;
        }
        return false;
    }

    addParticle(x, y, color, opts = {}) {
        if (this.particles.length < PARTICLE_LIMIT) {
            this.particles.push(new Particle(x, y, color, opts));
        }
    }

    draw() {
        drawCat(this);
    }
}

// ─── Enemy class ──────────────────────────────────────────────────────────────

class Enemy {
    constructor(type = 'basic') {
        this.type = type;
        this.width = type === 'strong' ? 58 : 48;
        this.height = type === 'strong' ? 72 : 60;
        this.x = WIDTH;
        this.y = GROUND_LEVEL - this.height;
        this.speed = Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + ENEMY_SPEED_MIN;
        this.health = type === 'strong' ? 50 : 30;
        this.maxHealth = this.health;
        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.2;
        this.particles = [];
    }

    takeDamage(amount) {
        this.health -= amount;
        this.hitFlashTimer = this.hitFlashDuration;
        screenShake(2, 0.1);
        for (let i = 0; i < 8; i++) {
            this.particles.push(new Particle(
                this.x + Math.random() * this.width,
                this.y + Math.random() * this.height,
                this.type === 'strong' ? '#ff8800' : '#88aaff',
                { glow: true, decay: 0.03 }
            ));
        }
        return this.health <= 0;
    }

    update() {
        this.x -= this.speed;
        this.particles = this.particles.filter(p => p.update());
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= 1/60;
        return this.x + this.width < 0;
    }

    draw() {
        drawEnemy(this);
    }
}

// ─── Screen shake ─────────────────────────────────────────────────────────────

let shakeAmount = 0, shakeDuration = 0;
function screenShake(amount, duration) {
    shakeAmount = Math.max(shakeAmount, amount);
    shakeDuration = Math.max(shakeDuration, duration);
}

// ─── Init & Loop ──────────────────────────────────────────────────────────────

async function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    initBackground();
    resetGame();
    document.getElementById('restartButton').addEventListener('click', () => {
        if (!gameActive) resetGame();
    });
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    player = new Player(PLAYER_START_X, GROUND_LEVEL - 80);
    enemies = [];
    score = 0;
    gameActive = true;
    lastEnemySpawn = 0;
    particles = [];
    backgroundOffset = 0;
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('score').style.display = 'none';
    document.getElementById('health').style.display = 'none';
}

function getCurrentSpawnRate() {
    const level = Math.floor(score / SCORE_THRESHOLD) + 1;
    return Math.max(500, BASE_ENEMY_SPAWN_RATE - (level * 200));
}
function getCurrentMaxEnemies() {
    const level = Math.floor(score / SCORE_THRESHOLD) + 1;
    return Math.min(MAX_ENEMIES, 3 + level);
}
function getEnemySpeed() {
    const level = Math.floor(score / SCORE_THRESHOLD) + 1;
    const bonus = level * 0.5;
    return { min: ENEMY_SPEED_MIN + bonus, max: ENEMY_SPEED_MAX + bonus };
}

function gameLoop(timestamp) {
    time = timestamp / 1000;

    if (!gameActive) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Screen shake
    ctx.save();
    if (shakeDuration > 0) {
        const sx = (Math.random() - 0.5) * shakeAmount * 2;
        const sy = (Math.random() - 0.5) * shakeAmount * 2;
        ctx.translate(sx, sy);
        shakeDuration -= 1/60;
        shakeAmount = Math.max(0, shakeAmount - 0.3);
        if (shakeDuration <= 0) { shakeAmount = 0; shakeDuration = 0; }
    }

    ctx.clearRect(-10, -10, WIDTH + 20, HEIGHT + 20);

    backgroundOffset += 1.5;
    if (backgroundOffset >= WIDTH) backgroundOffset = 0;

    drawBackground();

    // Global particles (score/death effects)
    particles = particles.filter(p => { p.draw(); return p.update(); });

    // Player
    player.update({ ArrowLeft: keys['ArrowLeft'], ArrowRight: keys['ArrowRight'] });
    player.draw();

    // Enemies
    if (timestamp - lastEnemySpawn > getCurrentSpawnRate() && enemies.length < getCurrentMaxEnemies()) {
        const enemyType = Math.random() < 0.3 ? 'strong' : 'basic';
        const enemy = new Enemy(enemyType);
        const speeds = getEnemySpeed();
        enemy.speed = Math.random() * (speeds.max - speeds.min) + speeds.min;
        enemies.push(enemy);
        lastEnemySpawn = timestamp;
    }

    enemies = enemies.filter(e => { e.draw(); return !e.update(); });

    // HUD
    drawHUD();

    // Collisions
    checkCollisions();

    score++;
    ctx.restore(); // screen shake

    requestAnimationFrame(gameLoop);
}

function checkCollisions() {
    for (let enemy of enemies) {
        if (player.attacking &&
            player.attackRect.x < enemy.x + enemy.width &&
            player.attackRect.x + player.attackRect.width > enemy.x &&
            player.attackRect.y < enemy.y + enemy.height &&
            player.attackRect.y + player.attackRect.height > enemy.y) {

            if (enemy.takeDamage(player.getAttackDamage())) {
                enemies = enemies.filter(e => e !== enemy);
                const pts = enemy.type === 'strong' ? 200 : 100;
                score += pts;
                // Burst
                for (let i = 0; i < 16; i++) {
                    particles.push(new Particle(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height / 2,
                        enemy.type === 'strong' ? '#ff8800' : '#ffd700',
                        { vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8 - 2, glow: true, decay: 0.02, size: 3 + Math.random() * 3 }
                    ));
                }
                // Score pop
                for (let i = 0; i < 6; i++) {
                    particles.push(new Particle(
                        enemy.x + enemy.width / 2,
                        enemy.y,
                        '#ffd700',
                        { vy: -4, vx: (Math.random() - 0.5) * 2, gravity: 0.05, decay: 0.025, size: 2, glow: true }
                    ));
                }
            }
        } else if (!player.hidden &&
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            if (player.takeDamage(enemy.type === 'strong' ? 30 : 20)) {
                gameOver();
            }
        }
    }
}

function gameOver() {
    gameActive = false;
    // Death explosion
    for (let i = 0; i < 30; i++) {
        particles.push(new Particle(
            player.x + player.width / 2,
            player.y + player.height / 2,
            ['#ff4444', '#ff8800', '#ffffff', '#ff00aa'][Math.floor(Math.random() * 4)],
            { vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14 - 3, glow: true, decay: 0.015, size: 4 + Math.random() * 4 }
        ));
    }
    const gameOverDiv = document.getElementById('gameOver');
    gameOverDiv.style.display = 'block';
    document.getElementById('finalScore').textContent = score;
}

const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === ' ' && gameActive) player.jump();
    if (e.key === 'f' && gameActive) player.attack();
    if (e.key === 'q' && gameActive) player.toggleInvisibility();
    if (e.key === 'r' && !gameActive) resetGame();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

init();
