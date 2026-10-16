export const stores = [
  {
    id: "wethersfield",
    name: "Wethersfield",
    address: "105 Silas Deane Hwy",
    city: "Wethersfield, CT 06109",
    phone: "(860) 667-6330",
    tel: "8606676330",
    detail: "Remote starters, stereo replacement & installation",
    specialty: "Car audio & remote starters",
    serviceIds: [
      "electronics-replacement",
      "electrical-installation",
      "car-audio",
      "remote-starters",
      "dash-cams",
      "gps-trackers",
    ],
  },
  {
    id: "hartford",
    name: "Hartford",
    address: "2814 Main St",
    city: "Hartford, CT 06120",
    phone: null,
    tel: null,
    detail: "Auto detailing & window tinting",
    specialty: "Detailing & window tinting",
    serviceIds: ["auto-detailing", "window-tinting"],
  },
];
export const services = [
  {
    id: "car-audio",
    name: "Car audio & stereo installation",
    short: "Hear the difference",
    description:
      "Clearer vocals. Fuller bass. The songs you know, with the details you’ve been missing. Build a sound system around your vehicle and the way you listen.",
    icon: "screen",
    items: [
      "Speaker upgrades and component systems",
      "Subwoofers, enclosures, and amplifiers",
      "Touchscreen receivers and factory-system integration",
    ],
  },
  {
    id: "remote-starters",
    name: "Remote starters",
    short: "Comfort starts here",
    description:
      "Make cold mornings and hot afternoons more comfortable. Explore a remote-start setup that fits your vehicle and your everyday routine.",
    icon: "screen",
    items: [
      "Vehicle and factory-key compatibility review",
      "Remote range and control options",
      "Installation planning and system walkthrough",
    ],
  },
  {
    id: "electronics-replacement",
    name: "Electronics replacement",
    short: "Time for an upgrade",
    description:
      "Replace outdated or nonworking vehicle electronics at our Wethersfield store. We replace equipment; we do not repair electronics.",
    icon: "screen",
    items: [
      "Replacement receivers, speakers, and electronics",
      "Vehicle fit and factory-feature compatibility",
      "Equipment selection and installation planning",
    ],
  },
  {
    id: "auto-detailing",
    name: "Auto detailing",
    short: "A fresh perspective",
    description:
      "Interior and exterior car detailing at our Hartford, Connecticut store. Tell us about your vehicle’s condition and the areas you would like refreshed.",
    icon: "car",
    items: [
      "A conversation about your vehicle’s condition",
      "Detailing scope tailored to your needs",
      "Scheduling and care recommendations",
    ],
  },
  {
    id: "electrical-installation",
    name: "Electrical installation",
    short: "Bring your next project",
    description:
      "Plan your car electronics installation at Action Audio in Wethersfield, near Hartford. Discuss receivers, speakers, and accessories, with compatibility checked for your vehicle.",
    icon: "screen",
    items: [
      "Equipment and vehicle compatibility",
      "Installation planning and cable routing",
      "A walkthrough of your new setup",
    ],
  },
  {
    id: "window-tinting",
    name: "Window tinting",
    short: "Comfort and a cleaner look",
    description:
      "Vehicle window tinting at our Hartford store. Tell us which windows you want tinted and whether existing film needs to be removed.",
    icon: "car",
    items: [
      "Window coverage and film options",
      "Existing tint and removal requirements",
      "Vehicle-specific installation planning",
    ],
  },
  {
    id: "dash-cams",
    name: "Dash cams",
    short: "A clearer view of your drive",
    description:
      "Dash cam installation at Action Audio in Wethersfield. Explore front, rear, and cabin camera setups suited to your vehicle.",
    icon: "screen",
    items: [
      "Front, rear, and cabin camera options",
      "Cable routing and power connection planning",
      "Parking-mode and equipment compatibility",
    ],
  },
  {
    id: "gps-trackers",
    name: "GPS trackers",
    short: "Stay connected to your vehicle",
    description:
      "GPS tracker installation at our Wethersfield store. Discuss a setup for your vehicle, the features you need, and compatible equipment.",
    icon: "screen",
    items: [
      "Vehicle and tracker compatibility",
      "Power and mounting requirements",
      "Connected-service and subscription options",
    ],
  },
];
export const statuses = [
  "requested",
  "confirmed",
  "checked_in",
  "in_progress",
  "waiting_parts",
  "quality_check",
  "ready",
  "completed",
  "cancelled",
];
export const statusLabels = {
  requested: "Request received",
  confirmed: "Appointment confirmed",
  checked_in: "Vehicle checked in",
  in_progress: "Work in progress",
  waiting_parts: "On hold · waiting for parts",
  quality_check: "Final checks",
  ready: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const serviceStore = (serviceId) =>
  stores.find((store) => store.serviceIds.includes(serviceId));
export const serviceAvailableAt = (storeId, serviceId) =>
  Boolean(
    stores
      .find((store) => store.id === storeId)
      ?.serviceIds.includes(serviceId),
  );
