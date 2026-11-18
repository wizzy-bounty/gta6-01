# SOLMAR HEAT

An original open-world crime game that runs entirely in the browser.
You are Riko "Vex" Marlowe, fresh out and already in debt to the wrong
people. Fixer Mara Voss has work: a chain of eight jobs — "The Solmar
Job" — that climbs from a stolen coupe in the Marina to the vault of the
Solmar Star, the casino yacht anchored off the pier.

## The city

Solmar City is a five-district island grid, fully explorable on foot or
by car:

- **Marina** — blue-and-white waterfront towers and the yacht pier
- **Old Town** — brick-yellow blocks around the hospital
- **Neon Strip** — purple-pink signs, Club Vex, cabs after dark
- **The Docks** — rust-grey container yards and cranes
- **Airport & Beach** — runway, terminal, and the south shore road

Every district has live traffic that queues at the lights, pedestrians
who dodge out of the way, and parked cars that can be stolen.

## Systems

- On-foot and driving gameplay with a full wanted system: police
  interceptors hunt your last seen position, and at four stars a police
  helicopter joins with a live spotlight you have to break out of
- Eight chained story missions with briefings, HUD objectives, timers,
  armed guards, an armored-van ambush, casino surveillance, and the
  yacht finale
- A safehouse with save / continue (browser local storage)
- Two switchable in-car radio stations plus synthesized engine, siren,
  and impact audio
- Day-night cycle, chase camera, minimap with live unit markers,
  start screen and pause menu

## Controls

- **WASD / arrows** — walk or drive · **Shift** — sprint
- **E** — interact: steal / enter / exit cars, start missions, save
- **F** — punch · **Mouse (click to lock)** — aim, click to shoot
- **R** — change radio station · **Esc / P** — pause

## Running it

The submission program is dependency-free Node:

```
node main.ts          # writes the game + screenshots + dossier to /output
node serve.ts         # or serve the game locally for play
```

The game itself is static: `game/index.html` plus the modules in
`game/src/`, rendered with the vendored Three.js build in
`game/vendor/`. No build step, no network calls.
