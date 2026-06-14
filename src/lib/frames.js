// Kozmetik avatar çerçeveleri — mağazadan GP ile alınır
export const FRAMES = {
  neon: {
    name: "Neon Hat",
    price: 1500,
    ring: "ring-2 ring-fuchsia-400 shadow-lg shadow-fuchsia-500/40",
    desc: "Mor neon ışıltısı. Klasik ama asla eskimez.",
  },
  gold: {
    name: "Altın Çember",
    price: 3000,
    ring: "ring-2 ring-amber-400 shadow-lg shadow-amber-500/40",
    desc: "Lig lideri havası, lider olmasan bile.",
  },
  fire: {
    name: "Alev Aurası",
    price: 5000,
    ring: "ring-2 ring-orange-500 shadow-lg shadow-orange-500/50",
    desc: "Form tutan oyuncunun çerçevesi. Herkes görsün.",
  },
};

export const frameRing = (frame) => FRAMES[frame]?.ring ?? "";
