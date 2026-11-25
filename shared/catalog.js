import { serviceContent } from "./service-content.js";
export const stores = [
  {
    id: "wethersfield",
    name: "Wethersfield",
    address: "105 Silas Deane Hwy",
    city: "Wethersfield, CT 06109",
    phone: "(860) 667-6330",
    tel: "8606676330",
    detail: "All vehicle services",
  },
  {
    id: "hartford",
    name: "Hartford",
    address: "2814 Main St",
    city: "Hartford, CT 06120",
    phone: null,
    tel: null,
    detail: "All vehicle services",
  },
];
export const services = serviceContent;
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
