// _sv_w1.js — the truck has NO lamp on top of it. Its only light is the set of amber HAZARD
// lenses the model itself carries on the REAR (buildTruck: one middle + two side lenses with
// additive halos, flashing 1s-sides / 1s-middle, and Midnight burns them hotter). The night rig
// had added two lamp cores and two square additive halos (1.8u and 1.35u quads) parked at the
// top of the box and the cab roof: unbillboarded, untextured additive quads = WHITE SQUARES of
// light glued to the top of the truck. The rig's job is to LIGHT the street around the parked
// truck, and it does that with its two PointLights; the lamp bodies are the model's business.
// The rig's cores are now invisible light anchors, its halo quads never exist, and the warm pool
// on the asphalt in front of the bumpers is all the rig ever shows.
const fs = require('fs');
const P = 'index.html';
let html = fs.readFileSync(P, 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const nl = (s) => s.replace(/\r?\n/g, EOL);
function edit(name, needle, repl) {
  const a = nl(needle), b = nl(repl);
  const n = html.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor matched ' + n + ' times');
  html = html.replace(a, b);
  console.log('patched: ' + name);
}

edit('mkLamp builds an INVISIBLE light anchor, not a lamp',
`        const mkLamp = (x, y, z, r, op) => {
          const core = new THREE.Mesh(
            new THREE.SphereGeometry(r, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xfff6e2, fog: false }),
          );
          core.castShadow = false;
          core.position.set(x, y, z);
          g.add(core);
          let halo = null;
          if (tex && THREE.PlaneGeometry) {
            halo = new THREE.Mesh(new THREE.PlaneGeometry(r * 9, r * 9), glowMk(op));
            halo.position.set(x, y, z + 0.08);
            halo.castShadow = false;
            g.add(halo);
          }
          return { core: core, halo: halo };
        };`,
`        // A rig "lamp" is a light ANCHOR: a point in space the rig's PointLight hangs from. It
        // is NOT a lamp body and it is NOT drawable — the truck's own lenses (the rear hazard
        // lights the model carries) are the only lights on top of this truck, and an additive
        // quad standing at a lamp position is a white SQUARE, not a glow.
        const mkLamp = (x, y, z) => {
          const core = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xffd9a8, fog: false }),
          );
          core.castShadow = false;
          core.visible = false; // an anchor for the PointLight; nothing on the truck is lit up
          core.position.set(x, y, z);
          g.add(core);
          return { core: core, halo: null };
        };`);

edit('the rig lamp positions are the scoop and the rear, never the cab roof',
`        const work = mkLamp(rear - 0.9, 0, 4.4, 0.2, 0.55); // the worklight over the scoop
        const beacon = mkLamp(front - 1.1, 0, 5.1, 0.15, 0.42); // the amber beacon on the cab`,
`        // Both anchors sit at the REAR, where the truck's real lamps are: over the hopper /
        // scoop face. Nothing is anchored on the cab roof, because nothing on this truck emits
        // light from the top.
        const work = mkLamp(rear - 0.9, 0, 4.4); // over the scoop, at the rear of the box
        const beacon = mkLamp(rear - 1.6, 0, 3.1); // behind the hazard lenses on the tail`);

edit('the update dims nothing that is not there',
`        if (parts.work.halo && parts.work.halo.material)
          parts.work.halo.material.opacity = 0.55 * k;
        if (parts.beacon.halo && parts.beacon.halo.material)
          parts.beacon.halo.material.opacity = 0.42 * k;`,
`        // (no halos on this rig: the truck's own rear hazard lenses carry the visible glow)`);
fs.writeFileSync(P, html, 'utf8');
console.log('INDEX WRITTEN');
