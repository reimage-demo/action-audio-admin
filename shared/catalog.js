export const stores = [
  {
    id: "wethersfield",
    name: "Wethersfield",
    address: "105 Silas Deane Hwy",
    city: "Wethersfield, CT 06109",
    phone: "(860) 667-6330",
    tel: "8606676330",
    detail: "In the Motts Shopping Center",
  },
  {
    id: "hartford",
    name: "Hartford",
    address: "2814 Main St",
    city: "Hartford, CT 06120",
    phone: null,
    tel: null,
    detail: "Your neighborhood mobile electronics specialists",
  },
];
export const services = [
  {
    id: "electronics-repair",
    name: "Auto electronics repair",
    short: "Get your electronics back on track.",
    description:
      "Having trouble with your vehicle’s electronics? Tell our team what’s happening so we can assess the issue and discuss the repair options.",
    icon: "tools",
    items: [
      "Vehicle electronics assessment",
      "Repair options for your vehicle",
      "Clear updates throughout your service",
    ],
  },
  {
    id: "auto-detailing",
    name: "Auto detailing",
    short: "A fresh look for your ride.",
    description:
      "Give your vehicle some extra care with auto detailing work. Talk with our team about your vehicle’s condition and the finish you have in mind.",
    icon: "car",
    items: [
      "Auto detailing work",
      "Care tailored to your vehicle",
      "Discuss your needs before your visit",
    ],
  },
  {
    id: "electrical-installation",
    name: "Auto electrical installation",
    short: "Installed with care.",
    description:
      "Bring your next vehicle electronics project to Action Audio. We’ll discuss your equipment, check compatibility, and plan an installation around your ride.",
    icon: "screen",
    items: [
      "Automotive electrical installation",
      "Equipment compatibility consultation",
      "Installation for your vehicle’s setup",
    ],
  },
];
export const statuses = [
  "requested",
  "confirmed",
  "checked_in",
  "in_progress",
  "waiting_parts",
  "ready",
  "completed",
  "cancelled",
];
export const statusLabels = {
  requested: "Request received",
  confirmed: "Appointment confirmed",
  checked_in: "Vehicle checked in",
  in_progress: "Work in progress",
  waiting_parts: "Waiting for parts",
  ready: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};
