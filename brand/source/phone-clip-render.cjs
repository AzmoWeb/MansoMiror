const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 540, height: 1170 } });
  await p.goto('file:///tmp/claude-0/clip/scene.html');
  const N = 300; // 10 s at 30 fps
  for (let i = 0; i < N; i++) {
    const data = await p.evaluate((t) => { draw(t); return document.getElementById('c').toDataURL('image/png'); }, i / N);
    fs.writeFileSync(`/tmp/claude-0/clip/frames/f${String(i).padStart(4, '0')}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  await b.close(); console.log('frames', N);
})();
