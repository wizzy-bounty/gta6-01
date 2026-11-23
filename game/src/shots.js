// shots.js — the four hero frames of MARISOL BAY, seeded mid-action.
//
// The dossier's screenshots are rendered by loading the game with
// ?shot=<name>: each setup poses the city at a frozen moment of the job —
// cars placed by hand, cruisers at ramming distance, the helicopter's
// spotlight pinned, the HUD fully populated. These are compositions, not
// spawn points: if a frame reads empty or calm, the seed is wrong.

import { DIALOG } from './missions.js';

export const SHOT_NAMES = ['beach', 'downtown', 'day', 'harbor'];

const CREW_LINES = {
  beach: { vera: 'CALLING THE PLAY', mako: 'RIDING SHOTGUN · RADIO', gus: 'WAITING AT PIER 9', ivy: 'EYES ON AIR-1' },
  downtown: { vera: 'CALLING THE PLAY', mako: 'WATCHING THE ROW', gus: 'WAITING AT PIER 9', ivy: 'COUNTING UNITS' },
  day: { vera: 'AT THE AZURE PEARL', mako: 'GT PREPPED · KEYS IN', gus: 'WAITING AT PIER 9', ivy: 'STREET IS QUIET' },
  harbor: { vera: 'COUNTING THE MONEY', mako: 'ON THE RADIO', gus: 'AT PIER 9 · LIGHTS ON', ivy: 'PATROL NEARBY' },
};

function crewStatus(hud, name) {
  for (const [id, text] of Object.entries(CREW_LINES[name])) hud.setCrewStatus(id, text);
}

/** ctx: everything main.js owns — see main.js makeShotContext(). */
export function applyShot(ctx, name) {
  const { hero, police, dax, vera, ivy, traffic, hud } = ctx;
  crewStatus(hud, name);
  switch (name) {
    case 'beach': {
      ctx.setMood('golden');
      hero.place(-118, -4, Math.PI + 0.22, 24); // angled: rear three-quarter, not a flat box
      hero.braking = true;
      police.setWanted(4);
      police.deploy(0, -113.9, -13.5, Math.PI - 0.08); // right flank, ramming distance
      police.deploy(1, -122.6, -3.0, Math.PI + 0.12); // rear-left, inside the frame
      police.deploy(2, -122.2, -19, Math.PI + 0.05); // second row, left lane
      police.heliAngle = -2.31; // Air-1 ahead-left, its cone raking the road in frame
      traffic[0]?.place(-121.5, -44, Math.PI, 10); // civilian ahead in lane
      ivy.place(-108.6, -16, -Math.PI / 2);
      ctx.cam(-120.6, 2.6, 5.8, -117.4, 1.1, -24);
      ctx.scriptedSpeedKmh = 111;
      ctx.stageIdx = 1;
      ctx.dialogSpec = ['ivy', DIALOG.heat.line];
      ctx.feedLines = [
        ['CRASH — WITNESSES CALLED IT IN', true],
        ['WANTED LEVEL 4 — MBPD RESPONDING', true],
        ['AIR SUPPORT OVERHEAD', false],
      ];
      ctx.zone = 'THE STRAND';
      break;
    }
    case 'downtown': {
      ctx.setMood('dusk');
      hero.place(4, 5.2, Math.PI / 2, 22);
      hero.braking = false;
      hero.setHeadlights(true, 0.55);
      police.setWanted(3);
      police.deploy(0, 8, 12.4, Math.PI / 2); // parallel in the south lane, alongside
      police.deploy(1, 26, 1.0, Math.PI / 2 - 0.05); // ahead-right, closing
      police.deploy(2, 62, 6.5, Math.PI / 2); // far ahead in lane
      police.deploy(3, 16, 12.8, Math.PI / 2 + 0.05); // second parallel unit
      police.deploy(4, 52, 0.5, Math.PI / 2); // ahead in the north lane
      police.units[0].car.setHeadlights(true, 0.45);
      police.units[1].car.setHeadlights(true, 0.45);
      police.units[3].car.setHeadlights(true, 0.45);
      traffic[0]?.place(44, 12.6, -Math.PI / 2, 9); // oncoming taxi, near miss
      traffic[0]?.setHeadlights(true, 0.7);
      traffic[1]?.place(-30, 0.5, Math.PI / 2, 8);
      traffic[1]?.setHeadlights(true, 0.5);
      ctx.cam(-8.6, 2.35, 9.2, 17, 1.15, 3.6);
      ctx.scriptedSpeedKmh = 105;
      ctx.stageIdx = 1;
      ctx.dialogSpec = ['mako', 'Row’s lit and the Row’s watching, Dax. Smooth hands — thread it, don’t kiss it.'];
      ctx.feedLines = [
        ['NEAR MISS — CIVILIAN TRAFFIC', false],
        ['ROADBLOCK REPORTED AHEAD', true],
        ['WANTED LEVEL 3 — MBPD RESPONDING', true],
      ];
      ctx.zone = 'CASINO ROW';
      break;
    }
    case 'day': {
      ctx.setMood('day');
      hero.place(-106, -63.5, 2.25, 0); // under the canopy, nose swung toward camera
      police.setWanted(0);
      dax.place(-115.5, -59.8, 1.93); // lower-left foreground, walking to the car
      dax.walkSpeed = 2.2;
      vera.place(-108.6, -60.6, -1.5); // beside the GT on the camera side, facing Dax
      ivy.place(-124.5, -50, 2.6); // lookout on the boulevard corner
      ctx.peds[0]?.place(-109, -50.5, 2.8); // guests crossing the driveway
      ctx.peds[1]?.place(-99.5, -58.5, -0.8);
      ctx.cam(-120.3, 2.0, -55.8, -105.5, 1.55, -63.8);
      ctx.scriptedSpeedKmh = 0;
      ctx.onFoot = true;
      ctx.stageIdx = 0;
      ctx.dialogSpec = ['vera', DIALOG.intro.line];
      ctx.feedLines = [
        ['CREW IN POSITION', false],
        ['JOB STARTED — LIFT THE VANTARA GT', false],
      ];
      ctx.zone = 'CASINO ROW';
      ctx.zoneOverride = 'THE STRAND · AZURE PEARL';
      break;
    }
    case 'harbor': {
      ctx.setMood('night');
      hero.place(168, 213, 0, 12);
      hero.setHeadlights(true, 0.85);
      police.setWanted(2);
      police.deploy(0, 171.8, 223, Math.PI); // facing the camera on the pier lane, lamps lit
      police.units[0].car.setHeadlights(true, 0.9);
      police.deploy(1, 152, 192, 0.7); // rolling through the yard, left of frame
      police.deploy(2, 198, 176, -2.2); // far corner of the yard
      police.deploy(3, 138, 158, 1.2); // back by the cross street
      ctx.gusAtPier();
      ctx.cam(168.8, 2.45, 204.4, 167.4, 0.95, 226);
      ctx.scriptedSpeedKmh = 55;
      ctx.stageIdx = 2;
      ctx.dialogSpec = ['gus', DIALOG.pier.line];
      ctx.feedLines = [
        ['JOB — MAKE THE PIER', false],
        ['WANTED LEVEL 2 — HARBOR PATROL', true],
        ['DELIVERY WINDOW — 1:36 TO THE TIDE', false],
      ];
      ctx.zone = 'HARBORFRONT';
      break;
    }
    default:
      return false;
  }
  return true;
}
